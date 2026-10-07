/* upstreem landing-hero.js — die Hero-Sektion der Landingpage.

   Was diese Datei tut und was sie ausdruecklich NICHT tut:

   Sie baut die Buehne (Ueberschrift, Unterzeile, Fensterrahmen) und setzt DIE ECHTEN KOMPONENTEN
   der App hinein: die Seitenleiste, den Dashboard-Seitenkopf, das Visibility-Chart und das
   Top-Citations-Dashboard. Kein Nachbau, kein Bild, kein Video -- dasselbe Markup und dieselbe CSS,
   die in Bubble laufen. Deshalb ist das Fenster in jeder Groesse scharf, und deshalb veraltet es
   nicht, wenn sich die App aendert.

   Das Markup der vier Komponenten steht weiter unten in einem erzeugten Block. Erzeugt heisst:
   .landing_markup.py zieht es aus den Bubble-Vorlagen und schreibt es hierher. Wer es von Hand
   aendert, verliert die Aenderung beim naechsten Lauf -- und die Landingpage weicht von der App ab,
   was der ganze Sinn dieser Bauart ist.

   Die Zahlen im Fenster sind DEMODATEN. Der Markt ist seit dem 21.09. der AUTOMOBILMARKT: die
   eigene Marke heisst Acme -- eine gehobene Marke mit Verbrenner- und E-Angebot --, und die
   Wettbewerber sind echte Hersteller (BMW, Audi, Tesla, Porsche, Volvo, VW, BYD, Lexus, Nio).
   Das ist eine bewusste Umkehr der frueheren Entscheidung, nur erfundene Marken zu zeigen:
   erfundene Zahlen unter echten Namen sehen auf einer oeffentlichen Seite wie Daten ueber diese
   Firmen aus. Deshalb sind die Werte PLAUSIBEL und nicht schmeichelhaft, keine Zahl behauptet
   etwas ueber einen Hersteller, was sich nachpruefen liesse, und die eigene Marke bleibt
   erfunden -- sie ist der Platzhalter fuer den Betrachter.

   Braucht: core.js, sidebar.js, dashboard-page-header.js, visibility-chart.js,
   topcitations-dashboard.js -- und diese Datei ZULETZT, weil sie deren Setter ruft. */
(function(){
  "use strict";

  /* Feste Kennungen. Es gibt genau eine Hero-Sektion pro Seite, also braucht keine davon eine
     laufende Nummer -- und feste Namen machen die Demodaten unten lesbar. */
  var ID = { usn: "lh-usn", dph: "lh-dph", vot: "lh-vot", tcd: "lh-tcd", upt: "lh-upt",
             urt: "lh-urt", udd: "lh-udd", hph: "lh-hph", uhm: "lh-uhm", ush: "lh-ush" };

  /* WARUM DER BLOCK UNTEN NIE VON HAND GETAUSCHT WIRD (28.09. gemeldet: "Export Icons in den
     Buttons sind noch nicht wie in der Hauptapp"). Beim Wechsel des Zeichensatzes am 22.09. sind
     die Zeichen HIER direkt ersetzt worden, statt den Block aus den Vorlagen neu zu erzeugen. Fuer
     fast alle war das folgenlos, denn core zieht sie zur Laufzeit ohnehin nach (ALT_ZEICHEN,
     TOOLBAR_ICONS) -- in der App wie hier. Die Export-Knoepfe (vot, tcd, upt, urt) und das
     Aufziehen im Chart kennt core aber in KEINER der beiden Listen: in der App zeigen sie also
     unveraendert das Zeichen der Vorlage, hier stand das von Hand eingesetzte. Gemessen nach dem
     Hochlauf: 306 Zeichen gleich, genau diese 8 verschieden. Neu erzeugt ist der Block wieder
     Zeichen fuer Zeichen die Vorlage, und die Landingpage zeigt, was die App zeigt. */
  /* ---- MARKUP ANFANG (erzeugt von .landing_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    usn: "<div class=\"up-root usn-root\" data-instance=\"lh-usn\" data-cdn-pin=\"\" data-isdark=\"no\" data-team-id=\"t1\" data-active=\"dashboard\" data-prompt-count=\"\" data-export-instance=\"\" data-upstreem-logo=\"\" data-upstreem-logo-dark=\"\" data-upstreem-logo-small=\"\" data-upstreem-logo-small-dark=\"\"></div>",
    dph: "<div class=\"up-root up-ph-root dph-root\" data-instance=\"lh-dph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2215%22%20fill%3D%22%230b0d10%22%2F%3E%3Cpath%20d%3D%22M29%2015.5%2016.2%2048.5H23.1L25.3%2041.9H38.7L40.9%2048.5H47.8L35%2015.5ZM32%2025.4%2028.9%2034.4H35.1Z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\" data-mode-default=\"standard\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><!-- KEINE Meta-Zeile auf dem Dashboard. dashboard-page-header.js baut sie zusaetzlich aus, falls sie in einer schon eingebauten Seite noch steht. --><h1 class=\"up-ph-heading\">Dashboard</h1><p class=\"up-ph-desc\">Monitor your AI visibility, performance, and latest developments</p></div><div class=\"dph-topright\"><!-- dashboard-page-header.js fuellt das weiter bei setDashboardPageHeaderKpis(), SICHTBAR ist es nicht mehr (dashboard-page-header.css: .dph-kpis { display: none }). Das Markup bleibt, damit der bestehende Setter nicht ins Leere laeuft. --><div class=\"dph-kpis\"></div><div class=\"dph-tools\"><!-- Nur das Zeichen, kein Wort: library-big -- dasselbe wie im Onboarding-Kopf. dashboard-page-header.js setzt es beim Init auch in einer schon eingebauten Seite und haengt .up-ph-iconbtn dazu. --><button class=\"dph-docsbtn up-ph-iconbtn\" type=\"button\" data-tip=\"Open Documentation\" aria-label=\"Open Documentation\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect width=\"8\" height=\"18\" x=\"3\" y=\"3\" rx=\"1\" /><path d=\"M7 3v18\" /><path d=\"M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z\" /></svg></button><!-- Lucide refresh-cw. dashboard-page-header.js setzt dasselbe Zeichen beim Init aus core (UC.icon(\"refreshCw\")) -- hier steht es fuer den Fall, dass das JS noch unterwegs ist, damit der Knopf nicht leer aufblitzt. Dieselben Pfade, geprueft gegen lucide-static. --><!-- Suche: drueckt Cmd+K (Strg+K) -- darauf hoert die Palette (Quick Actions) selbst. Kein Workflow noetig. Wer zusaetzlich einen will, setzt data-search-fn am Wurzelelement -- dann geht auch ein Ereignis heraus. dashboard-page-header.js baut diesen Knopf auch in eine schon eingebaute Seite. --><button class=\"dph-searchbtn up-ph-iconbtn\" type=\"button\" data-tip=\"Quick Actions\" aria-label=\"Open Quick Actions\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /></svg></button><button class=\"dph-refreshbtn up-ph-iconbtn\" type=\"button\" aria-label=\"Refresh\" data-tip=\"Refresh Data\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" /></svg></button></div></div></div></div>",
    vot: "<div class=\"up-root vot-root\" data-instance=\"lh-vot\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"vot-unit vot-unit-left\"><div class=\"vot-head\"><div class=\"vot-heading\">Visibility over Time</div><div class=\"vot-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\" data-tip=\"Day\" aria-label=\"Day\">D</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\" data-tip=\"Week\" aria-label=\"Week\">W</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\" data-tip=\"Month\" aria-label=\"Month\">M</button></div><button class=\"vot-maximize vot-max-top vot-iconbtn\" type=\"button\" data-tip=\"Minimize\" aria-label=\"Minimize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"vot-box vot-box-left\"><div class=\"vot-panel-body\"><button class=\"vot-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"vot-unit vot-unit-right\"><div class=\"vot-head\"><div class=\"vot-heading vot-heading-right\"><span class=\"vot-head-label\">Top Brands</span><span class=\"vot-head-sep\"></span><span class=\"vot-head-count\"></span></div><div class=\"vot-head-tools\"><div class=\"vot-sort\"><button class=\"vot-sort-btn vot-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"vot-filter\"><button class=\"vot-filter-btn vot-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"vot-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"vot-export vot-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"vot-maximize vot-max-right vot-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button><button class=\"vot-goto vot-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"vot-box vot-box-right\"><div class=\"vt-table\"></div></div></div></div>",
    tcd: "<div class=\"up-root tcd-root\" data-instance=\"lh-tcd\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.5 15.8278C17.9985 21.756 9.86407 23.4835 5.20143 18.8641C0.629484 14.3347 2.04493 6.12883 8.05653 3.5\"/><path d=\"M17.6831 12.5C19.5708 12.5 20.5146 12.5 21.1241 11.655C21.1469 11.6234 21.1848 11.5667 21.2052 11.5336C21.7527 10.6471 21.4705 9.966 20.9063 8.60378C20.3946 7.36853 19.6447 6.24615 18.6993 5.30073C17.7538 4.35531 16.6315 3.60536 15.3962 3.0937C14.034 2.52946 13.3529 2.24733 12.4664 2.79477C12.4333 2.81523 12.3766 2.85309 12.345 2.87587C11.5 3.4854 11.5 4.42922 11.5 6.31686V8.42748C11.5 10.3473 11.5 11.3072 12.0964 11.9036C12.6928 12.5 13.6527 12.5 15.5725 12.5H17.6831Z\"/></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21\"/><path d=\"M7 8V9C7 9.55228 7.44772 10 8 10H18C18.5523 10 19 9.55228 19 9V8C19 7.44772 18.5523 7 18 7H8C7.44772 7 7 7.44772 7 8Z\"/><path d=\"M7 15V16C7 16.5523 7.44772 17 8 17H14C14.5523 17 15 16.5523 15 16V15C15 14.4477 14.5523 14 14 14H8C7.44772 14 7 14.4477 7 15Z\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-sep\"></span><span class=\"tcd-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    mqa: "<div id=\"mira-quick-actions\" data-theme=\"light\" data-team=\"\" data-cdn-pin=\"\" data-export-instance=\"\"><button class=\"mqa-trigger\" type=\"button\" aria-label=\"Open quick actions\"><svg class=\"mqa-trigger-ic\" viewBox=\"0 0 24 24\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg><span class=\"mqa-trigger-label\">Quick Actions</span><span class=\"mqa-kbd\" data-kbd>\u2318K</span></button><div class=\"mqa-overlay\" role=\"presentation\" aria-hidden=\"true\"><div class=\"mqa-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Quick actions\"><div class=\"mqa-search\"><svg class=\"mqa-search-ic\" viewBox=\"0 0 24 24\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg><span class=\"mqa-chips\" id=\"mqa-chips\"></span><span class=\"mqa-inputwrap\"><input class=\"mqa-input\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"\" aria-label=\"Search\" /><span class=\"mqa-ph\" id=\"mqa-ph\" aria-hidden=\"true\"><span class=\"mqa-ph-lang\">Search brands, domains, URLs, prompts\u2026</span><span class=\"mqa-ph-kurz\">Search\u2026</span></span></span><span class=\"mqa-ph-cmd\" id=\"mqa-ph-cmd\" aria-hidden=\"true\">/ for filters</span><span class=\"mqa-kbd mqa-esc\" id=\"mqa-esc\">esc</span><button class=\"mqa-fav is-hidden\" type=\"button\" id=\"mqa-fav\" aria-pressed=\"false\" aria-label=\"Save as Favorite\"><svg viewBox=\"0 0 24 24\"><path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" /></svg></button><button class=\"mqa-clear is-hidden\" type=\"button\" id=\"mqa-clear\" aria-label=\"Reset search\"><svg viewBox=\"0 0 24 24\"><path d=\"M19.5 5.5L18.8803 15.5251C18.7219 18.0864 18.6428 19.3671 18.0008 20.2879C17.6833 20.7431 17.2747 21.1273 16.8007 21.416C15.8421 22 14.559 22 11.9927 22C9.42312 22 8.1383 22 7.17905 21.4149C6.7048 21.1257 6.296 20.7408 5.97868 20.2848C5.33688 19.3626 5.25945 18.0801 5.10461 15.5152L4.5 5.5\"/><path d=\"M3 5.5H21M16.0557 5.5L15.3731 4.09173C14.9196 3.15626 14.6928 2.68852 14.3017 2.39681C14.215 2.3321 14.1231 2.27454 14.027 2.2247C13.5939 2 13.0741 2 12.0345 2C10.9688 2 10.436 2 9.99568 2.23412C9.8981 2.28601 9.80498 2.3459 9.71729 2.41317C9.32164 2.7167 9.10063 3.20155 8.65861 4.17126L8.05292 5.5\"/><path d=\"M9.5 16.5L9.5 10.5\"/><path d=\"M14.5 16.5L14.5 10.5\"/></svg></button></div><!-- Die zwei Woerter in EIGENEN Spans: ein Satz aus drei Knoten laesst sich nicht uebersetzen. quick-actions.js zieht das bei bereits eingebauten Elementen zur Laufzeit nach (ctaTrennen). --><button class=\"mqa-entercta is-hidden\" type=\"button\" id=\"mqa-entercta\" data-worte=\"1\"><span>Press</span><span class=\"mqa-kbd\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 4v7a4 4 0 0 1-4 4H4\" /><path d=\"m9 10-5 5 5 5\" /></svg>Enter</span><span>to search</span></button><div class=\"mqa-scroll\"><div class=\"mqa-results\" aria-live=\"polite\"></div></div><div class=\"mqa-recent-wrap\" id=\"mqa-recent\"></div><div class=\"mqa-actions-wrap\"></div></div></div></div>",
    mira: "<div class=\"up-root am-root\" data-typespeed=\"1.6\" id=\"ask-mira\" data-instance=\"lh-mira\" data-cdn-pin=\"\" data-isdark=\"no\"><div class=\"am-shell\"><!-- ===================== HERO ===================== --><header class=\"am-hero\"><div class=\"am-hero-inner\"><div class=\"am-hero-text\"><div class=\"am-title-row\"><span class=\"am-brand\"><span class=\"am-logo-mark\" aria-hidden=\"true\"></span><span class=\"am-wordmark\">mira</span></span><span class=\"am-status-pill\" id=\"am-status-pill\"><span class=\"am-status-dot\"></span><span id=\"am-status-text\">Ready</span></span></div><p class=\"am-subline\">Chat with your AI Search data.</p></div><div class=\"am-chat-titlebar\" id=\"am-chat-titlebar\" aria-hidden=\"true\"><button class=\"am-ct-back\" id=\"am-ct-back\" type=\"button\" aria-label=\"Back to start\" data-tip=\"Back to start\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M15 6C15 6 9.00001 10.4189 9 12C8.99999 13.5812 15 18 15 18\"/></svg></button><button class=\"am-ct-name\" id=\"am-ct-name\" type=\"button\" data-tip=\"Rename chat\"><span class=\"am-ct-text\" id=\"am-ct-text\"></span><span class=\"am-ct-skeleton\" id=\"am-ct-skeleton\" aria-hidden=\"true\"></span></button><button class=\"am-ct-chev\" id=\"am-ct-chev\" type=\"button\" aria-label=\"Chat options\" aria-haspopup=\"menu\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><input class=\"am-ct-input\" id=\"am-ct-input\" type=\"text\" maxlength=\"120\" aria-label=\"Chat name\"><span class=\"am-ct-edit-actions\" id=\"am-ct-edit-actions\"><button class=\"am-ct-mini\" id=\"am-ct-save\" type=\"button\" data-tip=\"Save\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></button><button class=\"am-ct-mini\" id=\"am-ct-discard\" type=\"button\" data-tip=\"Discard\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></span></div><button class=\"am-ghost-btn am-prev-btn\" type=\"button\" id=\"am-open-prev\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic am-prev-ic\"><path d=\"M11 3H13C16.7712 3 18.6569 3 19.8284 4.17157C21 5.34315 21 7.22876 21 11V13C21 16.7712 21 18.6569 19.8284 19.8284C18.6569 21 16.7712 21 13 21H11C7.22876 21 5.34315 21 4.17157 19.8284C3 18.6569 3 16.7712 3 13V11C3 7.22876 3 5.34315 4.17157 4.17157C5.34315 3 7.22876 3 11 3Z\"/><path d=\"M8.00488 16.0049L8.00488 8.00488\"/></svg><span class=\"am-prev-label-full\">All Chats</span><span class=\"am-prev-label-short\">Chats</span></button></div></header><!-- ===================== CHAT VIEW ===================== --><main class=\"am-chat\" id=\"am-chat\"><div class=\"am-messages\" id=\"am-messages\"></div><!-- Suggested questions (shown when empty) --><div class=\"am-suggested\" id=\"am-suggested\"><div class=\"am-welcome\"><h2 class=\"am-welcome-title\" id=\"am-welcome-title\">How can I help you today?</h2></div><p class=\"am-suggested-label\" id=\"am-suggested-label\">Try asking</p><div class=\"am-suggested-grid\" id=\"am-suggested-grid\"></div><div class=\"am-quick\" id=\"am-quick\" aria-label=\"Quick actions\"></div></div></main><!-- ===================== COMPOSER ===================== --><footer class=\"am-composer-area\"><button class=\"am-scroll-bottom\" type=\"button\" id=\"am-scroll-bottom\" aria-label=\"Scroll to latest\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-composer-shell\" id=\"am-composer-shell\"><!-- ZWEITE FASSUNG (08.09.). Was hier stand: Textzeile und Aktionsspalte nebeneinander, ein Fader-Knopf und darunter ein ausklappbares Fach mit \"Answer detail\" und der Modellwahl. Beides ist weg -- Modell UND Aufwand liegen jetzt in EINER Schaltflaeche unten links, deren Menue nach oben aufgeht, und links davon ein Plus fuer den Entitaets-Picker. WICHTIG FUER EINEN BESTEHENDEN EINBAU: ask-mira.js baut das alte Markup zur Laufzeit selbst auf diese Fassung um (composerUmbauen). Wer sein Element in Bubble nicht anfasst, bekommt die neue Leiste trotzdem -- dieses Markup hier ist die Aufraeumarbeit fuer NEUINSTALLATIONEN, keine Voraussetzung. --><div class=\"am-composer is-v2\" id=\"am-composer\" data-am-composer=\"v5\"><!-- Der Picker: oberhalb des Feldes, auf seiner ganzen Breite. Er haengt AN .am-composer (position: relative) und nicht am Koerper: im Top Layer waere die volle Breite des Feldes nicht mehr herstellbar. --><div class=\"am-pick-panel\" id=\"am-pick-panel\" aria-hidden=\"true\"><div class=\"am-pick-search\"><svg width=\"24\" height=\"24\" class=\"am-pick-sic\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg><span class=\"am-pick-chips\" id=\"am-pick-chips\"></span><span class=\"am-pick-inwrap\"><input class=\"am-pick-input\" id=\"am-pick-input\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search your workspace\"></span><span class=\"am-pick-count\" id=\"am-pick-count\"></span></div><!-- Ueberschrift UND Chips in EINER Zeile, 16px auseinander, links ausgerichtet. --><div class=\"am-pick-crow\" id=\"am-pick-crow\"><p class=\"am-pick-h\" id=\"am-pick-h\"></p><!-- An der Stelle des frueheren Umschalters: die Befehle als Chips -- Brand, Prompt, Domain, URL. Getippt werden sie ueber \"/\" wie in Quick Actions. --><div class=\"am-pick-cmds\" id=\"am-pick-cmds\"></div></div><div class=\"am-pick-scroll\" id=\"am-pick-scroll\"><div class=\"am-pick-list\" id=\"am-pick-list\" role=\"listbox\" aria-live=\"polite\"></div></div></div><div class=\"am-quote-slot\" id=\"am-quote-slot\"></div><div class=\"am-input-wrap\"><!-- Die uebernommenen Bezuege stehen IM Textfeld, als erstes -- wie in Prompt Research (11.09.). Der Text geht direkt hinter der letzten Pille weiter: das Textfeld bekommt dafuer einen Einzug, den ask-mira.js aus der Lage der Pillen rechnet. ask-mira.js haengt den Streifen auch in einem aelteren eingebauten Element hierher um -- diese Stelle ist die Aufraeumarbeit fuer Neuinstallationen. --><div class=\"am-picks\" id=\"am-picks\"></div><textarea class=\"am-textarea\" id=\"am-textarea\" rows=\"1\" maxlength=\"2800\" placeholder=\"\"></textarea><div class=\"am-ph-loop\" id=\"am-ph-loop\" aria-hidden=\"true\"><span class=\"am-ph-text\" id=\"am-ph-text\">Ask Mira...</span></div></div><div class=\"am-actions\"><div class=\"am-act-l\"><button class=\"am-icon-action am-pick-btn\" type=\"button\" id=\"am-pick-btn\" aria-label=\"Add a reference\" aria-expanded=\"false\" data-tip=\"Add a reference\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M11.9922 4.00012V20.0001M19.9922 12.0001H3.99222\"/></svg></button></div><div class=\"am-act-r\"><div class=\"am-eff\" id=\"am-eff\"><button class=\"am-eff-btn\" type=\"button\" id=\"am-eff-btn\" aria-haspopup=\"true\" aria-expanded=\"false\"><span class=\"am-eff-name\" id=\"am-eff-name\"></span><span class=\"am-eff-lvl\" id=\"am-eff-lvl\"></span><svg width=\"24\" height=\"24\" class=\"am-eff-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-eff-menu\" id=\"am-eff-menu\" role=\"dialog\" aria-label=\"Model and effort\"><button class=\"am-eff-head\" type=\"button\" id=\"am-eff-head\" aria-expanded=\"false\"><span class=\"am-eff-hname\" id=\"am-eff-hname\"></span><span class=\"am-eff-hlvl\" id=\"am-eff-hlvl\"></span><svg width=\"24\" height=\"24\" class=\"am-eff-hchev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M9.00005 18C9.00005 18 15 13.5811 15 12C15 10.4188 9 6 9 6\"/></svg></button><!-- EIN Rumpf um beide Ansichten; seine Hoehe setzt ask-mira.js gemessen, damit das Menue beim Umschalten weich waechst statt zu springen. --><div class=\"am-eff-body\" id=\"am-eff-body\"><div class=\"am-eff-pane am-eff-slider\" id=\"am-eff-slider\"><div class=\"am-eff-track\" id=\"am-eff-track\" role=\"slider\" tabindex=\"0\" aria-valuemin=\"0\" aria-valuemax=\"2\" aria-valuenow=\"1\"><span class=\"am-eff-fill\" id=\"am-eff-fill\"></span><span class=\"am-eff-ultra\" id=\"am-eff-ultra\" aria-hidden=\"true\"><!-- Die Punkte in EIGENER Schicht: nur sie tragen den Ausblender nach links, der Verlauf darunter steht auf ganzer Breite. --><span class=\"am-eff-dots\" id=\"am-eff-dots\"></span></span><span class=\"am-eff-dot\" data-i=\"0\"></span><span class=\"am-eff-dot\" data-i=\"1\"></span><span class=\"am-eff-dot\" data-i=\"2\"></span><span class=\"am-eff-thumb\" id=\"am-eff-thumb\"></span></div><div class=\"am-eff-labels\" id=\"am-eff-labels\"></div></div><div class=\"am-eff-pane am-eff-models\" id=\"am-eff-models\"></div><p class=\"am-eff-note\" id=\"am-eff-note\"></p></div></div></div><button class=\"am-icon-action am-mic\" type=\"button\" id=\"am-mic\" aria-label=\"Voice input\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M7 6.5C7 4.01472 9.01472 2 11.5 2C13.9853 2 16 4.01472 16 6.5V11.5C16 13.9853 13.9853 16 11.5 16C9.01472 16 7 13.9853 7 11.5V6.5Z\"/><path d=\"M11.5 19H11.0828C7.57267 19 4.57706 16.4623 4 13M11.5 19H11.9172C15.4273 19 18.4229 16.4623 19 13M11.5 19V22\"/></svg></button><button class=\"am-send\" type=\"button\" id=\"am-send\" aria-label=\"Send message\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic am-ic-send\"><path d=\"M12 19V5\"/><path d=\"M5 12L12 5L19 12\"/></svg><span class=\"am-send-spinner\" aria-hidden=\"true\"></span></button></div></div><div class=\"am-rec\" id=\"am-rec\" aria-hidden=\"true\"><span class=\"am-rec-live\"><span class=\"am-rec-dot\"></span><span class=\"am-rec-time\" id=\"am-rec-time\">0:00</span></span><div class=\"am-rec-wave\"><canvas class=\"am-rec-canvas\" id=\"am-rec-canvas\"></canvas></div><span class=\"am-rec-spring\"></span><div class=\"am-rec-actions\"><button class=\"am-rec-btn am-rec-cancel\" type=\"button\" id=\"am-rec-cancel\" aria-label=\"Discard recording\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><button class=\"am-rec-btn am-rec-confirm\" type=\"button\" id=\"am-rec-confirm\" aria-label=\"Send recording\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></button></div></div></div><div class=\"am-rec-note\" id=\"am-rec-note\" role=\"status\" aria-live=\"polite\"></div></div></footer><!-- ===================== PREVIOUS CHATS PANEL ===================== --><div class=\"am-prev-scrim\" id=\"am-prev-scrim\" hidden></div><aside class=\"am-prev-panel\" id=\"am-prev-panel\" aria-hidden=\"true\"><div class=\"am-prev-head\"><p class=\"am-prev-title\">Previous chats</p><button class=\"am-icon-btn\" type=\"button\" id=\"am-close-prev\" aria-label=\"Close\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div><div class=\"am-prev-toolbar\"><button class=\"am-newchat\" type=\"button\" id=\"am-new-chat\"><svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M11.9922 4.00012V20.0001M19.9922 12.0001H3.99222\"/></svg><span>New Chat</span></button><button class=\"am-settings-btn\" type=\"button\" id=\"am-settings-btn\" aria-label=\"Settings\" data-tip=\"Settings\" aria-expanded=\"false\"></button></div><div class=\"am-hl-panel\" id=\"am-hl-settings-panel\"><div class=\"am-set-row\"><label class=\"am-set-label\">Brand Highlights</label><div class=\"am-dd\" id=\"am-dd-brand\" data-set=\"brand\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Citation Highlights</label><div class=\"am-dd\" id=\"am-dd-citation\" data-set=\"citation\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Icon</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"favicon\"><span class=\"am-dd-check\"></span><span>Favicon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Response Highlights</label><div class=\"am-dd\" id=\"am-dd-response\" data-set=\"response\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg width=\"24\" height=\"24\" class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div></div><div class=\"am-prev-list\" id=\"am-prev-list\"></div></aside></div></div>",
    pph: "<div class=\"up-root up-ph-root pph-root\" data-instance=\"lh-pph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2215%22%20fill%3D%22%230b0d10%22%2F%3E%3Cpath%20d%3D%22M29%2015.5%2016.2%2048.5H23.1L25.3%2041.9H38.7L40.9%2048.5H47.8L35%2015.5ZM32%2025.4%2028.9%2034.4H35.1Z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Database</span></div><h1 class=\"up-ph-heading\">Prompt Insights</h1><p class=\"up-ph-desc\">Manage Prompts, Topics and monitor latest Responses</p></div><div class=\"pph-topright\"><button class=\"up-ph-addbtn up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\" /><path d=\"M12 5v14\" /></svg><span>Add <span class=\"up-ph-addbtn-full\">Prompts</span></span></button><button class=\"pph-refreshbtn up-ph-iconbtn\" type=\"button\" aria-label=\"Refresh\" data-tip=\"Refresh Data\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" /></svg></button></div></div><!-- UC.makePageNav (core.js) builds the three tab items + the sliding indicator into this on init. --><div class=\"up-ph-nav\" role=\"tablist\"></div></div>",
    upt: "<div class=\"up-root upt-root\" data-instance=\"lh-upt\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"\" data-sticky=\"no\" data-sticky-top=\"171\" data-export-instance=\"\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Prompts</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span><span class=\"upt-selcount\"><span class=\"upt-selcount-n\">0 selected</span><button class=\"upt-selcount-clear\" type=\"button\" aria-label=\"Clear selection\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></span></div><div class=\"upt-status\" role=\"tablist\" aria-label=\"Prompt status\"></div><div class=\"up-head-tools\"><button class=\"upt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"upt-brand-toggle-lbl\"><img class=\"upt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"upt-brand-label\"></span></span><span class=\"upt-brand-check\"><svg class=\"upt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"upt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search prompts\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"upt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-prompt is-sortable\" data-sortcol=\"prompt\"><span class=\"upt-check\" role=\"checkbox\" tabindex=\"0\" aria-checked=\"false\" data-selectall></span><span class=\"up-th-txt\">Prompt</span><span class=\"up-thsort\" data-for=\"prompt\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span><span class=\"up-grip\" data-grip=\"prompt\"></span></div><div class=\"up-th up-th-visibility is-sortable\" data-sortcol=\"visibility\"><img class=\"upt-th-brandlogo\" src=\"\" alt=\"\"/><span class=\"up-th-txt\">Visibility</span><span class=\"up-th-info\" data-explain=\"visibility\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"visibility\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-th-info\" data-explain=\"rank\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-th-info\" data-explain=\"sentiment\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-topics\">Topics</div><div class=\"up-th up-th-market\">Market<span class=\"up-th-info\" data-explain=\"market\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-created is-sortable\" data-sortcol=\"created\"><span class=\"up-th-txt\">Created</span><span class=\"up-thsort\" data-for=\"created\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    oph: "<div class=\"up-root up-ph-root oph-root\" data-instance=\"lh-oph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2215%22%20fill%3D%22%230b0d10%22%2F%3E%3Cpath%20d%3D%22M29%2015.5%2016.2%2048.5H23.1L25.3%2041.9H38.7L40.9%2048.5H47.8L35%2015.5ZM32%2025.4%2028.9%2034.4H35.1Z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Workspace</span></div><h1 class=\"up-ph-heading\">Opportunities</h1><p class=\"up-ph-desc\">Manage tasks, prioritize opportunities, and track progress</p></div><button class=\"up-ph-addbtn up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 7V5a2 2 0 0 1 2-2h2\" /><path d=\"M17 3h2a2 2 0 0 1 2 2v2\" /><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\" /><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\" /><rect width=\"8\" height=\"8\" x=\"8\" y=\"8\" rx=\"1\" /></svg><span>Look for<span class=\"up-ph-addbtn-full\"> new Opportunities</span></span></button></div></div>",
    uo: "<div class=\"up-root uo-root\" data-portal=\"inline\" data-instance=\"lh-uo\" data-cdn-pin=\"\" data-isdark=\"no\" data-sticky=\"no\" data-sticky-top=\"16\"><div class=\"up-head uo-head\"><div class=\"up-heading has-count\"><span class=\"up-head-label\">Active Opportunities</span><span class=\"up-head-sep\"></span><span class=\"up-head-count uo-total\">0</span></div><div class=\"up-head-tools\"><!-- Sorter vor der Suche: dieselbe Reihenfolge wie in allen anderen Kopfzeilen. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uo-popwrap\"><button class=\"uo-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-menu uo-sort-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Sort by</div><div class=\"up-pop-opt is-active\" role=\"menuitem\" data-sort=\"priority\">Priority<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></div><div class=\"up-pop-opt\" role=\"menuitem\" data-sort=\"newest\">Newest<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg></div><div class=\"up-pop-div\"></div><div class=\"up-pop-row uo-toggle-external\"><span class=\"up-pop-label\">External only</span><span class=\"up-switch uo-switch-external\" role=\"switch\"></span></div></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search opportunities...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search opportunities\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-seg uo-mode\" role=\"tablist\" aria-label=\"View\"><button class=\"up-seg-btn is-active\" type=\"button\" role=\"tab\" data-mode=\"board\" data-tip=\"Board view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"18\" rx=\"1.5\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"11\" rx=\"1.5\"></rect></svg>Board</button><button class=\"up-seg-btn\" type=\"button\" role=\"tab\" data-mode=\"list\" data-tip=\"List view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 5h.01\" /><path d=\"M3 12h.01\" /><path d=\"M3 19h.01\" /><path d=\"M8 5h13\" /><path d=\"M8 12h13\" /><path d=\"M8 19h13\" /></svg>List</button></div><div class=\"uo-popwrap\"><button class=\"uo-settings-btn up-iconbtn\" type=\"button\" data-tip=\"Board settings\" aria-label=\"Board settings\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-menu uo-settings-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Lanes</div><div class=\"up-pop-row\" data-board=\"pending\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#9ca3af;\"></span>Pending</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"in_progress\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#2384E2;\"></span>In Progress</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"done\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#15803d;\"></span>Done</span><span class=\"up-switch\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"ignored\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#b4451f;\"></span>Ignored</span><span class=\"up-switch\" role=\"switch\"></span></div></div></div></div></div><!-- opportunities.js renders the lanes / list into this. --><div class=\"uo-stage\"></div><div class=\"uo-scrim\"></div><div class=\"uo-modal\" role=\"dialog\" aria-modal=\"true\"></div><!-- Optional: paste a JSON array here to render without a Run-JS step (useful while designing). --><script class=\"uo-data-json\" type=\"application/json\">[]</script></div>",
    urt: "<div class=\"up-root urt-root\" data-instance=\"lh-urt\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky=\"no\" data-sticky-top=\"171\" data-sticky=\"no\" data-default-view=\"cards\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    udd: "<div class=\"up-root udd-root\" data-instance=\"lh-udd\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand=\"Acme\"></div>",
    hph: "<div class=\"up-root up-ph-root pfph-root\" data-instance=\"lh-hph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Acme\" data-brand-logo=\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2215%22%20fill%3D%22%230b0d10%22%2F%3E%3Cpath%20d%3D%22M29%2015.5%2016.2%2048.5H23.1L25.3%2041.9H38.7L40.9%2048.5H47.8L35%2015.5ZM32%2025.4%2028.9%2034.4H35.1Z%22%20fill%3D%22%23fff%22%20fill-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Workspace</span></div><h1 class=\"up-ph-heading\">Performance</h1><p class=\"up-ph-desc\">Explore topic performance, compare brands, and uncover strengths and gaps</p></div></div></div>",
    uhm: "<div class=\"up-root uhm-root\" data-instance=\"lh-uhm\" data-cdn-pin=\"\" data-isdark=\"no\"><div class=\"up-head\"><div class=\"up-heading\">Performance Chart</div><div class=\"up-head-tools\"><div class=\"uhm-metric up-seg\" role=\"tablist\" aria-label=\"Metric\"><button class=\"up-seg-btn is-active\" data-metric=\"visibility\" type=\"button\" role=\"tab\" aria-selected=\"true\">Visibility</button><button class=\"up-seg-btn\" data-metric=\"rank\" type=\"button\" role=\"tab\" aria-selected=\"false\">Ranking</button><button class=\"up-seg-btn\" data-metric=\"sentiment\" type=\"button\" role=\"tab\" aria-selected=\"false\">Sentiment</button></div><!-- Der Einstellungsknopf steht ganz rechts, hinter dem Filter. Er stand vorher links davon; core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uhm-pick\"><button class=\"uhm-pick-btn up-iconbtn\" type=\"button\" data-tip=\"Brands &amp; Topics\" aria-label=\"Choose brands and topics\"></button><div class=\"uhm-pick-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"uhm-set\"><button class=\"uhm-set-btn up-iconbtn\" type=\"button\" data-tip=\"Settings\" aria-label=\"Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"uhm-set-menu up-menu\" role=\"menu\" aria-hidden=\"true\"></div></div></div></div><div class=\"uhm-box\"><div class=\"uhm-scroll\"><div class=\"uhm-grid\"></div></div></div></div>",
    ush: "<div class=\"up-root ush-root\" data-adresse=\"aus\" data-instance=\"lh-ush\" data-cdn-pin=\"\" data-isdark=\"no\"></div>"
  };
  /* ---- MARKUP ENDE ---- */

  /* ---------- Demodaten ----------------------------------------------------------------- */

  /* Hoechstens sieben Zeichen je Name. Gemessen: bei 1066px Inhaltsbreite -- und die ist fest,
     weil die Buehne fest ist -- kuerzt die Top-Brands-Tabelle "Northwind" auf "Northwi...".
     Genau daran haengt die Auswahl der Hersteller: Porsche hat sieben, alle anderen weniger.
     "Polestar" waere der achte Buchstabe gewesen und stand deshalb nicht zur Wahl; Nio steht
     dort als die zweite E-Marke neben BYD.
     Die Farben sind die LINEAR-Skala aus core.js (COLOR_SCALES.linear, 21.09. angefordert):
     sieben gleiche Schritte im Farbton von Blau bis Orange bei konstanter Helligkeit und
     Buntheit. Genau das ist ihr Punkt -- keine Linie ist heller als ihre Nachbarn, also draengt
     sich keine vor. Die Werte sind ABGESCHRIEBEN und nicht nachgemischt: waeren sie hier
     nachgerechnet, liefen sie beim naechsten Feinschliff drueben auseinander.
     Jede Marke hat ZWEI Zustaende. A ist der Anfang, B der Stand nach dem Filterwechsel drei
     Sekunden spaeter. Die eigene Marke (Acme) startet auf Platz 3 und geht auf 1 -- aufwaerts,
     nicht abwaerts, das war die Ansage. Platz 5 und 6 tauschen (Porsche und Volvo).
     Die VORZEICHEN der Trendwerte sind in A und B gleich. Das ist Absicht: so muss beim Wechsel nur
     die Zahl zaehlen, und Farbe und Pfeilrichtung des Trendzeichens bleiben, wie sie sind -- ein
     Umschlagen mitten in der Bewegung waere ein Sprung, den kein Zaehlen glaettet. Volvo war der
     Fall, der das erzwungen hat: es steigt von Platz 6 auf 5, also steht auch im Zustand A schon
     ein kleines Plus davor und nicht das Minus, das dort zuerst stand.
     WARUM DIESE SECHS OBEN STEHEN: das Fenster zeigt den Premiummarkt, in dem Acme steht. BMW
     und Audi fuehren ihn, Tesla, Porsche und Volvo folgen. VW, BYD, Lexus und Nio gehoeren zum
     selben Wettbewerbsfeld, stehen aber weiter unten (Team-Auswahl, Performance-Matrix,
     Prompts) -- sechs Linien sind das, was ein Chart lesbar traegt (MAX_LINE_SERIES). */
  var MARKEN = [
    { id: "ac", name: "Acme",    farbe: "#579cf1", domain: "acme.com",
      a: { vis: 24.6, rank: 2.4, sent: 74, visD: 2.1, rankD: -0.3, sentD: 1.4 },
      b: { vis: 38.9, rank: 1.1, sent: 79, visD: 5.8, rankD: -1.3, sentD: 3.1 } },
    { id: "bm", name: "BMW",     farbe: "#00aad3", domain: "bmw.de",
      a: { vis: 34.8, rank: 1.3, sent: 76, visD: 1.4, rankD: -0.1, sentD: 0.6 },
      b: { vis: 32.1, rank: 1.9, sent: 75, visD: 0.7, rankD: -0.4, sentD: 0.2 } },
    { id: "au", name: "Audi",    farbe: "#00b1ab", domain: "audi.de",
      a: { vis: 30.2, rank: 2.1, sent: 71, visD: 1.9, rankD: -0.2, sentD: 2.1 },
      b: { vis: 27.4, rank: 2.6, sent: 70, visD: 1.1, rankD: -0.5, sentD: 1.4 } },
    { id: "te", name: "Tesla",   farbe: "#2db477", domain: "tesla.com",
      a: { vis: 19.4, rank: 3.4, sent: 68, visD: -1.1, rankD: 0.4, sentD: -1.6 },
      b: { vis: 18.2, rank: 3.7, sent: 67, visD: -0.6, rankD: 0.2, sentD: -0.8 } },
    { id: "po", name: "Porsche", farbe: "#83a93a", domain: "porsche.com",
      a: { vis: 14.1, rank: 4.2, sent: 66, visD: -0.8, rankD: 0.3, sentD: 0.9 },
      b: { vis: 11.3, rank: 5.1, sent: 63, visD: -1.9, rankD: 0.7, sentD: 0.4 } },
    { id: "vo", name: "Volvo",   farbe: "#b69700", domain: "volvocars.com",
      a: { vis: 9.8,  rank: 5.3, sent: 63, visD: 0.6,  rankD: -0.1, sentD: 0.5 },
      b: { vis: 13.6, rank: 4.4, sent: 66, visD: 1.7,  rankD: -0.6, sentD: 1.2 } }
  ];
  /* Die vier weiteren Hersteller des Feldes. Sie tragen keine Chartlinie -- sechs sind das, was
     lesbar bleibt --, aber sie stehen in der Team-Auswahl, in der Performance-Matrix und in den
     Prompts. Ohne sie waere der Markt sechs Marken gross, und das waere fuer diesen Markt
     erkennbar zu klein. */
  var MARKEN_WEITER = [
    { id: "vw", name: "VW",    domain: "vw.de" },
    { id: "by", name: "BYD",   domain: "byd.com" },
    { id: "le", name: "Lexus", domain: "lexus.de" },
    { id: "ni", name: "Nio",   domain: "nio.com" }
  ];

  /* Das Zeichen einer ECHTEN Quelle. Der Dienst von Google liefert das Zeichen der Domain und
     fuer eine unbekannte einen Weltkugel-Rueckfall -- er antwortet also immer, und die
     Komponenten haben zusaetzlich ihr eigenes onerror (opportunities.js: favHtml,
     topcitations-dashboard.js). Keine eigene Kopie der Dateien: die waere am Tag ihrer Aufnahme
     richtig und danach veraltet.
     STEHT JETZT WEITER OBEN als frueher, weil seit dem 21.09. auch die MARKEN echte sind und
     ihre Zeichen von hier kommen. */
  function quellzeichen(domain){
    return "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(domain);
  }

  /* ACMES ZEICHEN -- ein Monogramm: schwarzes Plaettchen, weisses A, sonst nichts.
     Zwei Anlaeufe vorher waren Nachzeichnungen einer zugeschickten Marke, und beide waren zu
     zappelig: eine Form mit Haken und Balken traegt bei 15px Kantenlaenge -- so klein steht das
     Zeichen in der Markentabelle -- nicht mehr, sie wird zum Fleck. Ein Buchstabe in einem
     vollen Plaettchen traegt bis ganz herunter, und genau so sind die Zeichen gebaut, neben
     denen es steht (die Favicons der Hersteller).
     Selbst gezeichnet und als data:-Adresse: rechtlich eindeutig, kein Abruf, nichts, was fehlen
     kann. GEPRUEFT bei 120, 40, 24 und 15px, auf hellem und auf dunklem Grund.
     ES IST DASSELBE ZEICHEN AN ALLEN STELLEN: MARKEN[0] (Chart, Tabellen, Chips), TEAMS[0]
     (Umschalter) und BRAND_LOGO_URL in .landing_markup.py (Seitenkoepfe). Wer es tauscht,
     tauscht es an zwei Orten -- hier und dort. */
  var ACME_LOGO = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" rx="15" fill="#0b0d10"/>' +
    /* SYMMETRISCH um x=32 (21.09. nachgezogen: "das A ist zu weit rechts"). Der erste Wurf
       begann am Apex als PUNKT (32) und endete rechts oben auf 43.8 -- die Oberkante lief also
       von 32 nach 43.8 und die ganze Masse hing rechts. Jetzt hat die Spitze eine schmale
       Flaeche von 29 bis 35 (Mitte 32), die Fuesse stehen auf 16.2/23.1 und 40.9/47.8 (Mitte
       ebenfalls 32), und die Querstrebe liegt von 25.3 bis 38.7. */
    '<path d="M29 15.5 16.2 48.5H23.1L25.3 41.9H38.7L40.9 48.5H47.8L35 15.5Z' +
    'M32 25.4 28.9 34.4H35.1Z" fill="#fff" fill-rule="evenodd"/>' +
    '</svg>');

  /* Die eigene Marke traegt ihr Zeichen, die Wettbewerber ihres. Ein Buchstabenkaestchen gibt es
     nicht mehr: es war der Rueckfall fuer erfundene Marken, und erfunden ist nur noch Acme. */
  MARKEN.forEach(function(m){ m.logo = (m.id === "ac") ? ACME_LOGO : quellzeichen(m.domain); });
  MARKEN_WEITER.forEach(function(m){ m.logo = quellzeichen(m.domain); });

  /* Claude als eigenes Zeichen statt ueber den Favicon-Dienst. Der liefert fuer claude.ai das
     App-Kaestchen: weisser Stern auf gefuelltem Orange, und der Stern stoesst oben und unten an
     den Rand -- im Chip sah er beschnitten aus. Hier steht die blanke Marke ohne Hintergrund und
     mit Luft ringsum: der Pfad misst 24, der Rahmen 32, also 75% wie bei den anderen Zeichen.
     Eine Kopie ist hier richtig, obwohl bei quellzeichen das Gegenteil steht: dort geht es um die
     Zeichen beliebiger Quellen, die sich jederzeit aendern; hier um EINE Marke, die im Bild neben
     drei anderen steht. Der Pfad stammt aus simple-icons (CC0), die Farbe ist die der Marke. */
  var CLAUDE_ZUG = "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

  /* width und height muessen dranstehen: ein SVG ohne beide hat keine eigene Groesse, und ein
     img mit object-fit: cover faellt dann auf einen Rest zusammen -- gemessen 23x16 statt
     28x28, also wieder ein beschnittenes Zeichen, nur aus anderem Grund. */
  function claudezeichen(){
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
      '<path fill="#D97757" transform="translate(4,4)" d="' + CLAUDE_ZUG + '"/></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }

  /* Sechs MONATSpunkte, nicht dreissig Tagespunkte. Das Chart aggregiert nicht selbst --
     UC.buildLineDatasets nimmt die Serie, wie sie kommt --, also entscheidet die Serie die Stufe.
     Sechs Punkte im Monatsabstand ergeben eine Spanne von etwa 152 Tagen, und damit sperrt
     UC.granAvailability von sich aus "Day" (ueber 100 Tagen unlesbar) und gibt Week und Month frei.
     Die Achse beschriftet einen ganzen Monatsbereich nur mit dem Monatsnamen. */
  var PUNKTE = 6;

  function monatsliste(){
    var out = [], heute = new Date();
    for (var i = PUNKTE - 1; i >= 0; i--){
      /* Der ERSTE des Monats. Ein Punkt mitten im Monat waere kein ganzer Monatsbereich, und die
         Achse haette dann das Datum statt des Monatsnamens gezeigt. */
      var d = new Date(heute.getFullYear(), heute.getMonth() - i, 1);
      out.push(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01");
    }
    return out;
  }

  /* Der Verlauf: erst hoch, dann runter, dann wieder hoch -- alle Marken im selben Rhythmus, aber
     jede mit eigener Amplitude. Die Zahlen sind RELATIVE Ausschlaege in Vielfachen der Amplitude,
     also unabhaengig davon, wie hoch die Marke liegt:
       Monat 1  Ausgangswert
       Monat 2  +1.00   hoch
       Monat 3  +0.55   faellt schon wieder
       Monat 4  -0.85   unten
       Monat 5  -0.15   dreht
       Monat 6  +0.95   hoch
     Vorher stand hier eine Sinuswelle -- ein einziger Bogen, und das sah aus wie ein Trend, nicht
     wie eine Messreihe mit Bewegung. */
  var VERLAUF = [0, 1.0, 0.55, -0.85, -0.15, 0.95];

  /* Amplitude 6% bis 16% der eigenen Basis, gestaffelt statt gewuerfelt: fuenf Marken, fuenf
     Stufen. Das Doppelte der ersten Fassung (3% bis 8%) -- die Ausschlaege waren zu klein, um als
     Bewegung zu lesen.
     Gestaffelt, damit dasselbe Bild bei jedem Laden herauskommt: ein Chart, das sich bei jedem
     Aufruf anders bewegt, wirkt wie ein Fehler, und niemand kann sich auf einen Screenshot
     berufen. */
  function amplitude(mi){ return 0.06 + (mi % 5) * 0.025; }

  function reihen(z){
    var monate = monatsliste(), out = [];
    MARKEN.forEach(function(m, mi){
      var basis = m[z].vis;
      var a = amplitude(mi) * basis;
      var phase = mi * 1.05;
      monate.forEach(function(tag, ti){
        var wackeln = a * 0.06 * (((mi + ti) % 3) - 1);
        var wert = basis + VERLAUF[ti % VERLAUF.length] * a + wackeln;
        out.push({ company_id: m.id, day: tag, visibility_pct: Math.max(0, Math.round(wert * 10) / 10) });
      });
    });
    return out;
  }

  /* Der letzte Monat gegen den davor -- so entstehen die Deltas in der Tabelle und in den
     Kennzahlen. Gerechnet und nicht erfunden, damit Kurve und Zahlen zusammenpassen: eine
     steigende Linie neben einem fallenden Pfeil ist genau die Art Widerspruch, die einem
     aufmerksamen Betrachter auffaellt. */
  /* Die Tabelle sortiert sich nach Visibility, absteigend -- die Platzziffer ist die Reihenfolge und
     keine eigene Angabe. Damit ergibt sich der Platzwechsel aus den Zahlen und nicht aus einer
     zweiten Liste, die dazu passen muss. */
  function tabelle(z){
    return MARKEN.slice().sort(function(x, y){ return y[z].vis - x[z].vis; })
      .map(function(m, i){
        var d = m[z];
        return {
          company_id: m.id, name: m.name, logo_url: m.logo, position: i + 1,
          visibility_pct: d.vis, visibility_delta_pct: d.visD,
          avg_rank: d.rank, avg_rank_delta: d.rankD,
          sentiment: d.sent, sentiment_delta: d.sentD
        };
      });
  }

  /* DIE QUELLEN DES AUTOMOBILMARKTES (21.09.). Es sind die Seiten, aus denen KI-Antworten ueber
     Autos wirklich schoepfen: ein Testmagazin, das grosse deutsche Forum, Wikipedia, der ADAC.
     Der Anteil daneben ist eine Demozahl -- sie sagt, wie oft diese Seite in den Antworten
     ueber ACMES Prompts vorkam, und Acme ist erfunden. Sie behauptet also nichts ueber die
     Seite selbst.
     Die Zitattypen sind die ECHTEN der App -- UC.ALL_CITATION_TYPES: Editorial, UGC_Community,
     Knowledge_Base, Brand_Platform, Institutional, Competition, You. Sieben Zeilen, sieben
     Typen, jeder genau einmal: so steht neben jeder Farbe des Kuchens auch eine Zeile, die sie
     erklaert. Vorher kam Editorial zweimal vor und Institutional gar nicht -- der ADAC macht
     jetzt genau diese Zeile auf, und er ist fuer diesen Markt die naheliegendste Institution.
     Die eigenen zwei Zeilen tragen acmes Zeichen, die Wettbewerberzeile das von BMW -- dieselben
     Zeichen wie in der Markentabelle darueber, damit die Zeile ohne Lesen zuzuordnen ist. */
  var QUELLEN = [
    { domain: "forbes.com",                 share_pct: 18.4, share_delta_pct: 2.1,  used_total: 2926, citation_type: "Editorial" },
    { domain: "reddit.com",                 share_pct: 14.1, share_delta_pct: -1.3, used_total: 2242, citation_type: "UGC_Community" },
    { domain: "wikipedia.org",              share_pct: 11.7, share_delta_pct: 0.8,  used_total: 1860, citation_type: "Knowledge_Base" },
    { domain: "acme.com",               share_pct: 9.3,  share_delta_pct: 3.4,  used_total: 1479, citation_type: "You",
      logo: MARKEN[0].logo },
    { domain: "bmw.de",                     share_pct: 7.6,  share_delta_pct: -0.4, used_total: 1208, citation_type: "Competition",
      logo: MARKEN[1].logo },
    { domain: "konfigurator.acme.com",  share_pct: 6.2,  share_delta_pct: 1.9,  used_total: 986,  citation_type: "Brand_Platform",
      logo: MARKEN[0].logo },
    { domain: "adac.de",                    share_pct: 4.8,  share_delta_pct: -0.7, used_total: 763,  citation_type: "Institutional" }
  ];
  QUELLEN.forEach(function(q){ if (!q.logo) q.logo = quellzeichen(q.domain); });

  var TYPEN = [
    { type: "Editorial",      share_pct: 31.4 },
    { type: "UGC_Community",  share_pct: 21.8 },
    { type: "Knowledge_Base", share_pct: 15.2 },
    { type: "You",            share_pct: 11.6 },
    { type: "Competition",    share_pct: 9.3 },
    { type: "Brand_Platform", share_pct: 6.9 },
    { type: "Institutional",  share_pct: 3.8 }
  ];

  /* ---------- Buehne bauen ---------------------------------------------------------------- */

  /* Die Prompts-Liste steht im LISTENmodus. Und der heisst in dieser Komponente groupsWide = JA:
     "Defaults to List Mode (wide)" steht so im Quelltext von prompts-table.js. Der Name meint die
     breite Ansicht MIT Gruppenliste an der Seite -- also die Liste. Ausgeschaltet zeigt die
     Tabelle die gestapelten Gruppenkoepfe, und genau das war das gemeldete "alles im Widemode".
     Ich hatte "no" geschrieben und damit das Gegenteil eingestellt.
     Der Modus ist eine Ansichtsvorliebe und liegt in der Ablage; die Tabelle liest sie EINMAL beim
     Start (readGroupsWide). Deshalb wird sie hier geschrieben, bevor das Markup steht: die Wurzel
     der Tabelle gibt es dann noch nicht, die Komponente bootet also danach und liest diesen Wert.
     Geschrieben wird er AUSDRUECKLICH und nicht der Voreinstellung ueberlassen -- wer die Seite
     mit dem falschen Wert schon einmal geladen hat, hat ihn in seiner Ablage stehen.
     Ein Klick auf den Umschalter waere der andere Weg, aber die Buehne schluckt Klicks in der
     Einfangphase. */
  function listenmodusSetzen(){
    try {
      var k = "upt_groupswide__" + ID.upt;
      var kern = window.UpstreemCore;
      if (kern && kern.prefSet && kern.prefKey) kern.prefSet(kern.prefKey(k), "yes");
      else window.localStorage.setItem(k, "yes");
    } catch (e){}
  }

  /* Das helle Thema auf dem Weg, den die App selbst benutzt. hellHalten stempelt nur Attribute --
     ein Chart, das schon gezeichnet ist, hat seine Farben aber im Bild und rechnet sie nicht neu.
     setUpstreemTheme sagt allen Bauteilen Bescheid, die sich dafuer angemeldet haben (onTheme in
     core.js), und die zeichnen daraufhin neu. Genau daran lag es, dass die vier Charts der
     Domain-Detail-Sektion in dunklen Farben standen, obwohl an ihrer Wurzel "light" stand:
     gezeichnet wurden sie, bevor das Attribut da war, und niemand hat es ihnen danach gesagt.
     Danach kommt hellHalten und haelt die Wurzeln hell -- seit dem 06.10. in derselben Schreibweise
     wie core (kein data-theme), damit die beiden nicht mehr gegeneinander schreiben (Begruendung
     dort). */
  function themaHell(){
    try { if (window.setUpstreemTheme) window.setUpstreemTheme("light"); } catch (e){}
  }

  function bauen(root){
    if (root.querySelector(".ulh-frame")) return;          /* schon gebaut */
    listenmodusSetzen();
    themaHell();
    root.innerHTML =
      /* Die zwei Schienen. Sie laufen ueber die GANZE Seite und nicht je Sektion: die Seite hat
         eine Spur, und alles darin richtet sich an derselben Kante aus -- der Rahmen des Fensters
         oben genauso wie die Karten unten. Deshalb ein eigenes Element an der Wurzel und keine
         Raender an den Sektionen: zwei Sektionen mit je eigenen Raendern haetten an ihrer
         Beruehrung eine doppelte Linie. */
      '<div class="ulh-schienen" aria-hidden="true"></div>' +
      leiste() +
      /* Die Hero-Sektion ist ab hier ein eigener Kasten. Vorher war ihr Hintergrundbild inset: 0
         an der Wurzel -- mit einer zweiten Sektion darunter waere es ueber die ganze Seite
         gelaufen. */
      '<section class="ulh-hero">' +
      /* Der Hintergrund steht als ERSTES im Markup und nicht als letztes: bei gleichem z-index
         entscheidet die Reihenfolge, und so liegt er hinter allem, ohne dass jedes Geschwister
         einen eigenen Wert braucht. Reihenfolge darin: der blaue Verlauf hinten (ulh-bg-foto,
         der Name stammt noch aus der Zeit des Bildes), das Linienraster davor. */
      '<div class="ulh-bg" aria-hidden="true">' +
        '<span class="ulh-bg-foto"></span>' +
        '<span class="ulh-bg-grid"></span>' +
      '</div>' +
      '<div class="ulh-text">' +
        '<p class="ulh-eyebrow">' +
          /* Als Badge (30.09.): vorn das Zeichen (Zap, ohne Kreis), dahinter der Satz. Das
             Zeichen kommt ueber data-ic aus core wie jedes andere auf dieser Seite (zeichenSetzen). */
          '<span class="ulh-chip"><span class="ulh-chip-in">' +
            '<span class="ulh-chip-ic" data-ic="zap" data-ic-w="1.9" aria-hidden="true"></span>' +
            '<span class="ulh-chip-t">Get mentioned in AI search</span></span></span>' +
        '</p>' +
        '<h1 class="ulh-h1"><span>AI Search Analytics</span><span>Made simple.</span></h1>' +
        /* Der Umbruch nach "drive" steht hier und nicht in der CSS: die drei Treiber sollen zu
           dritt in einer Zeile stehen, und das ist eine Aussage ueber den Text, nicht ueber die
           Breite. Seit dem 06.10. ohne Zeichen davor (angefordert). */
        '<p class="ulh-sub">Track and optimize your brand’s AI search performance and drive' +
          '<span class="ulh-drivers">' +
            '<span class="ulh-driver">Qualified Traffic</span>' +
            '<span class="ulh-driver">Leads</span>' +
            '<span class="ulh-driver">Revenue</span>' +
          '</span>' +
        '</p>' +
        '<div class="ulh-cta">' +
          '<button class="ulh-btn ulh-btn-sec" type="button">Talk to Sales</button>' +
          /* Der Pfeil (06.10. angefordert) kommt wie jedes Zeichen der Seite aus core und wird von
             zeichenSetzen() nachgeliefert; sein Platz steht schon vorher (landing-hero.css), damit
             der Knopf nicht breiter springt, wenn er kommt. */
          '<button class="ulh-btn ulh-btn-pri" type="button">Book a Demo' +
            '<span class="ulh-btn-pfeil" data-ic="arrowRightLong" data-ic-w="2" aria-hidden="true"></span></button>' +
        '</div>' +
      '</div>' +
      /* data-up-keepclip an Ausschnitt und Buehne: core entklammert beim Mount jeder Komponente
         jeden beschneidenden Vorfahren (unclipAncestors -- gegen die Gruppencontainer von Bubble,
         die Sticky-Koepfe und Dropdowns abschneiden). Hier ist der Beschnitt aber der Rahmen des
         Fensters, und ohne diese zwei Marken lief die Prompts-Tabelle unter dem Fenster weiter --
         gemessen: overflow an beiden stand auf visible, obwohl in der CSS hidden steht. */
      '<div class="ulh-stage">' +
        /* Die BUEHNE traegt die Verkleinerung beim Scrollen, nicht mehr das Fenster selbst: die
           drei Nebenfenster muessen dieselbe Bewegung machen wie das Hauptfenster, sonst wandern
           sie beim Scrollen relativ zu ihm. Sie ist genau so breit wie das Hauptfenster (der
           Deckel steht jetzt hier), damit die Nebenfenster sich mit left/right/top/bottom an
           SEINEN Kanten ausrichten koennen und nicht an der ganzen Sektion.
           Zweiter Gewinn: die Eingangsanimation laeuft weiter auf .ulh-frame, die Verkleinerung
           auf der Buehne -- zwei Transformationen, die sich vorher am selben Element in die Quere
           kamen (eine laufende animation schlaegt jeden Inline-Stil). */
        '<div class="ulh-buehne">' +
        fensterTeams() +
        fensterAntwort() +
        '<div class="ulh-frame">' +
          chrom() +
          '<div class="ulh-view" data-up-keepclip>' +
            '<div class="ulh-app" data-up-keepclip>' +
              /* Quick Actions ist ein Seiten-Singleton und steht deshalb neben der Leiste, nicht
                 darin. sidebar.js haengt es von selbst in seine eigene Zeile um -- genau so
                 laeuft es in der App auch. */
              (MARKUP.mqa || "") +
              '<div class="ulh-side">' + (MARKUP.usn || "") + '</div>' +
              /* Zwei Seiten UEBEREINANDER im selben Kasten, nicht nacheinander: die Sektion
                 wechselt vom Dashboard zu Mira, und eine ausgeblendete Seite darf keinen Platz mehr
                 brauchen. Mira steht von Anfang an im Markup -- sie richtet sich an ihrer echten
                 Groesse ein (Chathoehe, is-compact, Scrollsperre), und mit display: none haette
                 sie eine Hoehe von 0 gemessen. */
              /* data-up-kopfrahmen (29.09. spaet): die Seite ist fuer den Seitenkopf, was in der
                 App die Bubble-Gruppe ist -- er misst gegen sie und steht damit wie dort: Inhalt
                 16 links und 8 rechts vom Rand, die Linien bis an die Kante (UC.makePageCrumbs). */
              '<div class="ulh-seiten">' +
                '<div class="ulh-seite ulh-main" data-up-kopfrahmen>' +
                  (MARKUP.dph || "") + (MARKUP.vot || "") + (MARKUP.tcd || "") +
                '</div>' +
                '<div class="ulh-seite ulh-mira">' + (MARKUP.mira || "") + '</div>' +
                '<div class="ulh-seite ulh-prompts" data-up-kopfrahmen>' +
                  (MARKUP.pph || "") + (MARKUP.upt || "") +
                '</div>' +
                '<div class="ulh-seite ulh-chancen" data-up-kopfrahmen>' +
                  (MARKUP.oph || "") + (MARKUP.uo || "") +
                '</div>' +
                /* Fuenfte Seite: Performance. Sie steht am Ende des Kreislaufs, weil sie die Frage
                   beantwortet, die nach den Chancen kommt -- "und wo stehe ich je Thema?". */
                '<div class="ulh-seite ulh-perf" data-up-kopfrahmen>' +
                  (MARKUP.hph || "") + (MARKUP.uhm || "") +
                '</div>' +
                /* Sechste Seite (06.10.): Shopping. Nach Performance, vor dem Neustart -- sie
                   zeigt den Teil der Antworten, den die Seiten davor nicht kennen: Produkte. Die
                   Komponente bringt ihren Kopf selbst mit (Krumen, Reiter). */
                '<div class="ulh-seite ulh-shop" data-up-kopfrahmen>' + (MARKUP.ush || "") + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        fensterUrls() +
        '</div>' +
      '</div>' +
      '</section>' +
      merkmale() +
      handel() +
      ereignisse() +
      quellen() +
      msc() +
      geo() +
      stimme() +
      preise() +
      fuss();
  }

  /* ---------- Die Leiste oben --------------------------------------------------------------
     Logo links, drei Punkte in der Mitte, zwei Knoepfe rechts. Zwei der Punkte oeffnen beim
     Ueberfahren ein Panel, und es ist EIN Panel: es wandert und aendert seine Groesse, wenn man
     von einem Punkt zum anderen faehrt, statt zu schliessen und neu aufzugehen. Genau das ist der
     Unterschied zwischen "zwei Menues" und "einem Menue, das folgt".
     Beide Inhalte stehen dauerhaft darin, uebereinander gelegt und nur ueber die Deckkraft
     getauscht. Das ist der Grund, warum das Panel seine Zielgroesse KENNT, bevor es faehrt: sie
     laesst sich am Inhalt messen, der schon da ist. Wer den Inhalt erst beim Oeffnen einsetzt,
     misst nach dem Einsetzen -- und dann ist die Fahrt schon vorbei.

     STICKY: die Leiste klebt oben, solange die SEITE scrollt. Steckt die Sektion in einem
     Embed-Rahmen (Framer), kann sie das nicht -- dort scrollt nicht dieses Fenster, sondern das
     darueber, und ein sticky-Element kennt nur seinen eigenen Scrollkasten. In dem Fall gehoert
     die Navigation in den Baukasten. */
  var NAV_PUNKTE = [
    { k: "platform", t: "Platform" },
    { k: "resources", t: "Resources" }
  ];
  var NAV_MENUES = {
    /* Die Punkte unter "Platform" zeigen auf Stellen DIESER Seite -- der Klick scrollt dorthin,
       keine Adresse, kein Neuladen. */
    platform: { spalte: "Platform", eintraege: [
      { t: "Overview", s: "What upstreem shows you", ziel: ".ulh-feat" },
      { t: "Source Insights", s: "Which pages answers are built from", ziel: ".ulh-quell" },
      { t: "Agentic AEO", s: "Mira does the work for you", ziel: ".ulh-msc" }
    ]},
    resources: { spalte: "Resources", eintraege: [
      { t: "Blog", s: "Notes on AI search", href: "https://upstreem.ai/blog" },
      { t: "Documentation", s: "How everything works", href: "https://docs.upstreem.ai/welcome" }
    ]}
  };

  function navKarte(k){
    var m = NAV_MENUES[k];
    return '<div class="ulh-nav-karte" data-menue="' + k + '">' +
      '<span class="ulh-nav-spalte">' + m.spalte + '</span>' +
      m.eintraege.map(function(e){
        var attr = e.href ? ' href="' + e.href + '" target="_blank" rel="noopener"'
                          : ' href="#" data-ziel="' + e.ziel + '"';
        return '<a class="ulh-nav-eintrag"' + attr + '>' +
          '<span class="ulh-nav-e-t">' + e.t + '</span>' +
          '<span class="ulh-nav-e-s">' + e.s + '</span>' +
        '</a>';
      }).join("") +
    '</div>';
  }

  function leiste(){
    return '<header class="ulh-nav">' +
      '<div class="ulh-spur ulh-nav-in">' +
        '<a class="ulh-nav-logo" href="https://upstreem.ai" aria-label="upstreem">' +
          '<img src="' + WORTMARKE + '" alt="upstreem" width="141" height="20"/>' +
        '</a>' +
        '<nav class="ulh-nav-mitte">' +
          NAV_PUNKTE.map(function(p){
            return '<button class="ulh-nav-punkt" type="button" data-menue="' + p.k + '">' +
              p.t + '</button>';
          }).join("") +
          '<a class="ulh-nav-punkt" href="https://upstreem.ai/pricing" target="_blank"' +
            ' rel="noopener">Pricing</a>' +
        '</nav>' +
        '<div class="ulh-nav-rechts">' +
          /* Anmelden und Registrieren gehen in einen NEUEN Tab: die Seite ist die Werbung, die
             App ist die Arbeit -- wer sich anmeldet, soll die Seite nicht verlieren. */
          '<a class="ulh-btn ulh-btn-sec" target="_blank" rel="noopener"' +
            ' href="https://app.upstreem.ai/signup?mode=login">Log in</a>' +
          '<a class="ulh-btn ulh-btn-pri" target="_blank" rel="noopener"' +
            ' href="https://app.upstreem.ai/signup">Start for free</a>' +
        '</div>' +
        '<div class="ulh-nav-pop" aria-hidden="true">' +
          navKarte("platform") + navKarte("resources") +
        '</div>' +
      '</div>' +
    '</header>';
  }

  /* Das Panel folgt dem Zeiger. Gemessen wird am Inhalt, der schon dasteht -- deshalb kennt es
     seine Zielgroesse, bevor es faehrt.
     Geschlossen wird beim Verlassen der GANZEN Leiste und mit einer kurzen Nachfrist: der Weg von
     einem Punkt zum Panel fuehrt ueber ein paar Pixel Nichts, und ohne Frist faellt es genau dort
     zu. */
  function navLauf(root){
    var nav = root.querySelector(".ulh-nav");
    var pop = root.querySelector(".ulh-nav-pop");
    if (!nav || !pop) return;
    var karten = {};
    [].forEach.call(pop.querySelectorAll(".ulh-nav-karte"), function(k){
      karten[k.getAttribute("data-menue")] = k;
    });
    var offen = null, uhr = null;

    function zeigen(k, knopf){
      clearTimeout(uhr);
      if (offen === k) return;
      offen = k;
      var karte = karten[k];
      if (!karte) return;
      /* Beim ERSTEN Oeffnen springt das Panel an seine Stelle, ohne Uebergang: sonst faehrt es von
         der linken Kante (Lage 0) herueber, waehrend es aufblendet -- gemeldet als "es fliegt von
         oben links herein". Von da an sind Lage und Groesse Uebergaenge, denn dann WANDERT es
         wirklich von einem Punkt zum naechsten.
         Der Sprung braucht ein erzwungenes Neuberechnen dazwischen, sonst fasst der Browser beide
         Schreibvorgaenge zu einem zusammen und der Uebergang laeuft doch. */
      var zu = !pop.classList.contains("is-offen");
      if (zu) pop.style.transition = "none";
      for (var name in karten) karten[name].classList.toggle("is-da", name === k);
      /* Die Groesse KOMMT VOM INHALT und wird nicht geschaetzt: die Karte steht schon im Panel,
         also hat sie eine Groesse -- auch die unsichtbare. */
      pop.style.width = karte.offsetWidth + "px";
      pop.style.height = karte.offsetHeight + "px";
      /* Die Lage folgt dem Punkt, bleibt aber in der Spur.
         Gesucht wird an der LEISTE und nicht an der Wurzel: haengt sie in der Seite darueber
         (leisteAuslagern), steht sie nicht mehr in der Wurzel -- die Suche fand dann nichts, und
         das Menue blieb zu, obwohl es seine Groesse schon gesetzt hatte. Genau so gemessen. */
      var flaeche = nav.querySelector(".ulh-nav-in");
      if (!flaeche) return;
      var innen = flaeche.getBoundingClientRect();
      var r = knopf.getBoundingClientRect();
      var x = r.left - innen.left - 20;
      var max = innen.width - karte.offsetWidth;
      if (x > max) x = max;
      if (x < 0) x = 0;
      pop.style.transform = "translateX(" + Math.round(x) + "px)";
      if (zu){
        void pop.offsetWidth;               /* Neuberechnen erzwingen */
        pop.style.transition = "";
      }
      pop.classList.add("is-offen");
      nav.classList.add("is-offen");
    }
    function schliessen(){
      clearTimeout(uhr);
      uhr = setTimeout(function(){
        offen = null;
        pop.classList.remove("is-offen");
        nav.classList.remove("is-offen");
      }, 140);
    }

    [].forEach.call(nav.querySelectorAll(".ulh-nav-punkt[data-menue]"), function(b){
      b.addEventListener("mouseenter", function(){ zeigen(b.getAttribute("data-menue"), b); });
      b.addEventListener("focus", function(){ zeigen(b.getAttribute("data-menue"), b); });
    });
    /* Ein Punkt OHNE Menue schliesst es -- sonst bliebe es offen, waehrend man auf Pricing steht. */
    [].forEach.call(nav.querySelectorAll(".ulh-nav-punkt:not([data-menue])"), function(b){
      b.addEventListener("mouseenter", schliessen);
    });
    nav.addEventListener("mouseleave", schliessen);
    pop.addEventListener("mouseenter", function(){ clearTimeout(uhr); });

    /* Die Punkte unter "Platform" scrollen zu ihrer Sektion. Welches FENSTER dabei scrollt, haengt
       davon ab, ob die Sektion in einem Rahmen steckt: dann bewegt sich das Fenster darueber und
       nicht dieses. Derselbe Grund wie beim Lagegeber. */
    [].forEach.call(pop.querySelectorAll("[data-ziel]"), function(a){
      a.addEventListener("click", function(e){
        e.preventDefault();
        var ziel = root.querySelector(a.getAttribute("data-ziel"));
        if (!ziel) return;
        schliessen();
        var l = lage(ziel);
        var weg = l.oben - 90;                 /* 90px: die Leiste steht im Weg */
        try {
          var rahmen = window.frameElement;
          var w = rahmen ? rahmen.ownerDocument.defaultView : window;
          w.scrollBy({ top: weg, behavior: "smooth" });
        } catch (err){
          window.scrollBy({ top: weg, behavior: "smooth" });
        }
      });
    });
  }

  /* ---------- Siebte Sektion: ein Satz, der es zusammenfasst ---------------------------------
     Ein Zitat, ein Name, ein Knopf. Der Satz ist als Zitat gesetzt (Serifen, gross, mittig) und
     nicht als weitere Ueberschrift: er soll wie eine Stimme klingen und nicht wie die Seite.
     Der Grund traegt dasselbe 8er-Raster wie die Seite, hier als Punkte statt Striche -- eine
     Flaeche, kein Gitter, damit der Satz allein steht. */
  /* Der Umbruch steht IM Satz und nicht im Zufall der Breite: "See what AI answers" ist die
     Frage, "say about you." die Pointe. */
  var STIMME = "See what AI answers<br>say about you.";
  var STIMME_SUB = "Connect your brand, pick the prompts that matter, and watch the answers as " +
    "they change. The first report takes minutes.";
  var STIMME_CTA = "Start for free";
  var STIMME_CTA2 = "Talk to sales";

  function stimme(){
    return '<section class="ulh-stimme">' +
      '<div class="ulh-spur ulh-stimme-in">' +
        '<h2 class="ulh-stimme-satz ulh-auf">' + STIMME + '</h2>' +
        '<p class="ulh-stimme-sub ulh-auf" style="--auf:1">' + STIMME_SUB + '</p>' +
        '<div class="ulh-stimme-knoepfe ulh-auf" style="--auf:2">' +
          '<a class="ulh-btn ulh-btn-pri" target="_blank" rel="noopener"' +
            ' href="https://app.upstreem.ai/signup">' + STIMME_CTA + '</a>' +
          '<a class="ulh-btn ulh-btn-sec" href="https://upstreem.ai/contact">' + STIMME_CTA2 + '</a>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---------- Die Preise --------------------------------------------------------------------
     Dieselbe Karte wie im Abrechnungsschritt des Onboardings (.uob-plan), nur groesser: dort muss
     der ganze Ablauf ohne Scrollen auf einen 760px-Schirm passen, hier hat die Seite Platz. Was
     uebernommen ist: Rahmen und Radius, "Most popular" auf der MITTLEREN Karte, die Ersparnis als
     Zeile, die beim Jahrestakt aufklappt, der Monats-/Jahresschalter und die Reihenfolge der
     Merkmale. Was groesser ist: Polster 28/26/30 statt 16/16/18, Radius 18 statt 16, Name 17 statt
     15, Betrag 38 statt 26, Merkmale 13.5 statt 12.

     Die Zahlen sind die der Tarif-RPC (dieselben, die das Onboarding anzeigt): 89/205/429 im
     Monat, 948/2220/4380 im Jahr. Die Ersparnis daneben ist GERECHNET und nicht getippt -- ein
     getippter Prozentwert waere beim naechsten Preis falsch.

     Jahr ist die Vorbelegung: der Jahrespreis ist der guenstigere, und ein Besucher soll die
     Seite nicht erst umstellen muessen, um den Preis zu sehen, den er am Ende zahlt.

     WICHTIG fuer jede Farbe hier: --vc-* haengt in core an .up-root, und diese Sektion steht
     ausserhalb. Ohne Rueckfall waere die ganze Regel ungueltig -- genau daran hatte die erste
     Fassung ihren Rahmen verloren. Also --ulh-* nehmen, wo es einen gibt, sonst var(--vc-x, wert). */
  var PREIS_CHIP = "Pricing";
  var PREIS_H = "Simple plans. Every answer engine.";   /* nicht "One price": es sind drei */
  var PREIS_SUB = "Every plan tracks ChatGPT, Perplexity and Google AI Overviews \u2014 with unlimited " +
    "seats, unlimited countries and prompts that run every day.";
  var PREIS_CTA = "Get started";
  var PREIS_ZIEL = "https://app.upstreem.ai/signup";
  var PREIS_FUSS = "Prices exclude VAT. Cancel any time.";
  var TARIFE = [
    { name: "Essential", mon: 89, jahr: 948,
      desc: "Get started with basic monitoring and analytics",
      prompts: "50", antworten: "4,650", mehr: false, marken: "6", hilfe: "Standard email support" },
    { name: "Professional", mon: 205, jahr: 2220,
      desc: "Advanced monitoring and AI search insights",
      prompts: "150", antworten: "13,500", mehr: false, marken: "11", hilfe: "Personal account manager" },
    { name: "Enterprise", mon: 429, jahr: 4380,
      desc: "Advanced features for growing businesses",
      prompts: "350", antworten: "30,000", mehr: true, marken: "16", hilfe: "Personal account manager" }
  ];
  /* Der angezeigte Betrag ist IMMER ein Monatsbetrag -- beim Jahrestakt der Jahrespreis durch
     zwoelf. Nur so stehen die drei Karten in einer vergleichbaren Groesse nebeneinander. */
  function preisMonat(t, jaehrlich){ return jaehrlich ? t.jahr / 12 : t.mon; }
  function preisSpar(t){ return Math.round(100 - (t.jahr / (t.mon * 12)) * 100); }
  /* Ganze Euro, wenn die Zahl ganz ist -- 79 statt 79.0. Krumme Betraege bekommen eine Stelle,
     damit aus 82,5 nicht 83 wird. */
  function preisGeld(v){
    var g = Math.round(v * 10) / 10;
    return (g % 1 === 0 ? String(g) : g.toFixed(1)) + "\u20ac";
  }
  function preisZeile(html){
    /* Das Zeichen kommt aus core und wird von zeichenSetzen() nachgeliefert -- zum Zeitpunkt des
       Markups gibt es UC noch nicht. 2.6 ist die Staerke, die auch die Karte im Onboarding fuehrt. */
    return '<li class="ulh-preis-zeile"><span class="ulh-preis-ic" data-ic="check" data-ic-w="2.6"></span>' +
           '<span>' + html + '</span></li>';
  }
  function preisKarte(t, i){
    /* Empfohlen ist die MITTLERE Karte, wie im Onboarding -- nicht die teuerste. */
    var top = i === 1;
    var spar = preisSpar(t);
    return '<div class="ulh-preis-karte' + (top ? " is-top" : "") + '">' +
        (top ? '<span class="ulh-preis-tag">Most popular</span>' : "") +
        '<div class="ulh-preis-name">' + t.name + '</div>' +
        '<p class="ulh-preis-desc">' + t.desc + '</p>' +
        '<div class="ulh-preis-betrag">' +
          '<span class="ulh-preis-zahl">' + preisGeld(preisMonat(t, true)) + '</span>' +
          '<span class="ulh-preis-je">/ month</span>' +
        '</div>' +
        /* Die Ersparnis klappt auf und zu, statt zu erscheinen und zu verschwinden: so schiebt sie
           die Kartenhoehe weich mit, wie im Onboarding. is-on steht schon hier, weil Jahr die
           Vorbelegung ist. */
        '<div class="ulh-preis-notiz is-on"><span>Save ' + spar + '% billed yearly</span></div>' +
        '<a class="ulh-btn ulh-btn-pri ulh-preis-btn" href="' + PREIS_ZIEL + '"' +
          ' target="_blank" rel="noopener">' + PREIS_CTA + '</a>' +
        '<ul class="ulh-preis-liste">' +
          preisZeile("<b>Choose which models to track</b>") +
          preisZeile("Track multiple models") +
          preisZeile("Track up to <b>" + t.prompts + " prompts</b>") +
          preisZeile("Prompts executed daily") +
          preisZeile((t.mehr ? "Analyze more than " : "Analyze up to ") +
                     "<b>" + t.antworten + " AI responses per month</b>") +
          preisZeile("Unlimited countries / languages") +
          preisZeile("Unlimited seats for your team") +
          preisZeile("Track up to <b>" + t.marken + " brands / competitors</b>") +
          preisZeile(t.hilfe) +
        '</ul>' +
      '</div>';
  }
  function preise(){
    return '<section class="ulh-preis" id="pricing">' +
      '<div class="ulh-spur">' +
        '<div class="ulh-feat-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + PREIS_CHIP + '</span>' +
          '<h2 class="ulh-feat-h">' + PREIS_H + '</h2>' +
          '<p class="ulh-feat-sub">' + PREIS_SUB + '</p>' +
        '</div>' +
        /* Der Schalter ist .up-seg aus core -- dasselbe Bauteil wie im Onboarding, nur in der
           32px-Form (is-lg). Seine Farbmarken setzt die CSS hier lokal, weil core sie an .up-root
           haengt und diese Sektion keine ist. */
        '<div class="ulh-preis-schalter ulh-auf" style="--auf:1">' +
          '<div class="up-seg is-lg" role="tablist" aria-label="Billing interval">' +
            '<button class="up-seg-btn" type="button" role="tab" aria-selected="false"' +
              ' data-interval="monthly">Monthly</button>' +
            '<button class="up-seg-btn is-active" type="button" role="tab" aria-selected="true"' +
              ' data-interval="yearly">Yearly</button>' +
          '</div>' +
        '</div>' +
        '<div class="ulh-preis-reihe ulh-auf" style="--auf:2">' +
          TARIFE.map(preisKarte).join("") +
        '</div>' +
        '<p class="ulh-preis-fuss ulh-auf" style="--auf:3">' + PREIS_FUSS + '</p>' +
      '</div>' +
    '</section>';
  }
  /* Der Wechsel zwischen Monat und Jahr. Derselbe Weg wie im Onboarding: Markup bleibt stehen,
     der Schalter stellt um, die Ersparnis klappt auf oder zu, und der Betrag ZAEHLT auf die neue
     Zahl. Ein Preis, der umspringt, liest sich wie ein anderer Preis -- ein zaehlender sagt, dass
     es derselbe Tarif zu anderen Bedingungen ist. */
  function preiseBinden(root){
    var sek = root.querySelector(".ulh-preis"); if (!sek || sek.__ulhPreis) return;
    sek.__ulhPreis = true;
    var karten = sek.querySelectorAll(".ulh-preis-karte");
    sek.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("[data-interval]") : null;
      if (!b || !sek.contains(b)) return;
      var jaehrlich = b.getAttribute("data-interval") === "yearly";
      var sw = sek.querySelectorAll("[data-interval]");
      for (var i = 0; i < sw.length; i++){
        var an = (sw[i].getAttribute("data-interval") === "yearly") === jaehrlich;
        sw[i].classList.toggle("is-active", an);
        sw[i].setAttribute("aria-selected", an ? "true" : "false");
      }
      for (var k = 0; k < karten.length; k++){
        var t = TARIFE[k]; if (!t) continue;
        var zahl = karten[k].querySelector(".ulh-preis-zahl");
        if (zahl) preisZaehlen(zahl, preisMonat(t, jaehrlich));
        var notiz = karten[k].querySelector(".ulh-preis-notiz");
        if (notiz) notiz.classList.toggle("is-on", jaehrlich);
      }
    });
  }
  /* Von der Zahl, die dasteht, auf die neue. Die Ausgangszahl wird aus dem TEXT gelesen und nicht
     mitgefuehrt: so stimmt sie auch, wenn mitten im Zaehlen erneut umgeschaltet wird. 380ms mit
     weichem Ausklang, wie im Onboarding. */
  function preisZaehlen(el, ziel){
    var von = parseFloat(String(el.textContent || "").replace(/[^0-9.]/g, ""));
    if (!isFinite(von)) von = ziel;
    if (el.__uhr) cancelAnimationFrame(el.__uhr);
    var t0 = 0, DAUER = 380;
    (function lauf(ts){
      if (!t0) t0 = ts || 0;
      var p = Math.min(1, ((ts || 0) - t0) / DAUER);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = preisGeld(von + (ziel - von) * e);
      if (p < 1) el.__uhr = requestAnimationFrame(lauf);
      else { el.__uhr = 0; el.textContent = preisGeld(ziel); }
    })(0);
  }

  /* ---------- Der Fuss ----------------------------------------------------------------------
     Schwarz, ueber die ganze Breite: das Ende der Seite soll auch wie eines aussehen. Links die
     Marke und darunter die zwei Netzwerke, rechts die Spalten. Die Adressen sind die echten der
     Seite -- ein Fuss mit toten Verweisen ist schlimmer als keiner. */
  var FUSS_SPALTEN = [
    { t: "Product", e: [
      { t: "Overview", h: "https://upstreem.ai" },
      { t: "Pricing", h: "https://upstreem.ai/pricing" },
      { t: "Log in", h: "https://app.upstreem.ai/signup?mode=login" }
    ]},
    { t: "Resources", e: [
      { t: "Blog", h: "https://upstreem.ai/blog" },
      { t: "Documentation", h: "https://docs.upstreem.ai/welcome" }
    ]},
    { t: "Legal", e: [
      { t: "Terms of service", h: "https://upstreem.ai/terms-of-service" },
      { t: "Privacy policy", h: "https://upstreem.ai/privacy-policy" },
      { t: "Imprint", h: "https://upstreem.ai/imprint" }
    ]}
  ];
  var FUSS_NETZ = [
    { t: "LinkedIn", h: "https://www.linkedin.com/company/upstreem", ic: "linkedin" },
    { t: "YouTube", h: "https://www.youtube.com/@upstreem", ic: "youtube" }
  ];
  /* Die zwei Zeichen stehen HIER als Pfad und kommen nicht aus core: core fuehrt Feather, und
     Feather hat keine Markenzeichen. Selbst gezeichnet waeren sie falsch -- das sind die
     offiziellen Umrisse. */
  var FUSS_IC = {
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 ' +
      '2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM10 9h3.8v1.7h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.6 ' +
      '4.76 5.98V21h-4v-5.5c0-1.31-.02-3-1.85-3-1.85 0-2.13 1.43-2.13 2.9V21h-4z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.5-.45-5.17a2.9 2.9 ' +
      '0 0 0-2.04-2.05C18.85 4.33 12 4.33 12 4.33s-6.85 0-8.51.45A2.9 2.9 0 0 0 1.45 6.83C1 8.5 1 ' +
      '12 1 12s0 3.5.45 5.17a2.9 2.9 0 0 0 2.04 2.05c1.66.45 8.51.45 8.51.45s6.85 0 8.51-.45a2.9 ' +
      '2.9 0 0 0 2.04-2.05C23 15.5 23 12 23 12zM9.8 15.3V8.7l5.7 3.3z"/></svg>'
  };

  function fuss(){
    var jahr = new Date().getFullYear();
    return '<footer class="ulh-fuss">' +
      '<div class="ulh-spur ulh-fuss-in">' +
        '<div class="ulh-fuss-marke">' +
          '<a class="ulh-fuss-logo" href="https://upstreem.ai" aria-label="upstreem">' +
            '<img src="' + WORTMARKE + '" alt="upstreem" width="218" height="31"/>' +
          '</a>' +
          '<p class="ulh-fuss-satz">See how AI answers talk about your brand.</p>' +
          '<div class="ulh-fuss-netz">' +
            FUSS_NETZ.map(function(n){
              return '<a class="ulh-fuss-ic" href="' + n.h + '" target="_blank" rel="noopener"' +
                ' aria-label="' + n.t + '">' + FUSS_IC[n.ic] + '</a>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="ulh-fuss-spalten">' +
          FUSS_SPALTEN.map(function(sp){
            return '<div class="ulh-fuss-spalte">' +
              '<span class="ulh-fuss-kopf">' + sp.t + '</span>' +
              sp.e.map(function(e){
                return '<a class="ulh-fuss-link" href="' + e.h + '" target="_blank"' +
                  ' rel="noopener">' + e.t + '</a>';
              }).join("") +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
      '<div class="ulh-spur ulh-fuss-unten">' +
        '<span>© ' + jahr + ' upstreem. All rights reserved.</span>' +
        '<button class="ulh-fuss-link ulh-fuss-nachweis-knopf" type="button" data-ulh-nachweis' +
          ' aria-expanded="false" aria-controls="ulh-bildnachweis">Image credits</button>' +
      '</div>' +
      '<div class="ulh-spur ulh-fuss-nachweis" id="ulh-bildnachweis" hidden>' + bildnachweisHtml() + '</div>' +
    '</footer>';
  }
  /* DER BILDNACHWEIS IM FUSS (06.10. nachts so entschieden). 8 der 10 Produktfotos stehen unter
     CC BY oder CC BY-SA, und die verlangen einen Nachweis, den man FINDEN kann: Titel, Urheber,
     Quelle, Lizenz (TASL). Der sichtbare Block unter den Shopping-Karten war auf Wunsch weg, der
     title am Foto allein reicht dafuer nicht. Jetzt: ein Knopf "Image credits" in der letzten Zeile
     des Fusses, darunter klappt der vollstaendige Nachweis auf -- Titel mit Link auf die Seite bei
     Commons, Urheber, Lizenz mit Link auf ihren Text. Ein Knopf und kein <details>: so bleibt die
     Zeile stehen, wenn der Nachweis aufgeht, und der Text bekommt die volle Breite. */
  var LIZENZ_URL = {
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 3.0 de": "https://creativecommons.org/licenses/by-sa/3.0/de/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/"
  };
  function bildnachweisHtml(){
    function a(href, text){ return '<a href="' + href + '" target="_blank" rel="noopener">' + text + '</a>'; }
    /* Als Titel steht das WERK, also der Dateititel bei Commons -- nicht der Produktname der Demo:
       das Foto des "Acme Home Charger" zeigt eine Wallbox von Delta Electronics, und ein Nachweis,
       der sie unter dem erfundenen Namen fuehrt, waere keiner. */
    function werk(seite){
      var t = seite;
      try { t = decodeURIComponent(seite); } catch (e){}
      return t.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
    }
    return '<p>Product photos from Wikimedia Commons: ' +
      ECHTE_PRODUKTE.map(function(p){
        var lz = LIZENZ_URL[p.lizenz] ? a(LIZENZ_URL[p.lizenz], p.lizenz) : p.lizenz;
        return a("https://commons.wikimedia.org/wiki/File:" + p.seite, "\u201c" + werk(p.seite) + "\u201d") +
          ' by ' + p.autor + ' (' + lz + ')';
      }).join(", ") + '.</p>' +
      '<p>Ad illustrations: US Environmental Protection Agency, public domain, via ' +
        a("https://openclipart.org", "Openclipart") + '.</p>';
  }
  /* Auf- und zuklappen, mit aria-expanded fuer Vorleser. Eigener Griff, weil die Sektion Klicks
     nur im nachgebauten App-Fenster schluckt (nurSchauen) -- der Fuss liegt ausserhalb. */
  function nachweisBinden(root){
    var knopf = root.querySelector("[data-ulh-nachweis]"), feld = root.querySelector("#ulh-bildnachweis");
    if (!knopf || !feld || knopf.__ulhNachweis) return;
    knopf.__ulhNachweis = true;
    knopf.addEventListener("click", function(){
      var auf = feld.hasAttribute("hidden");
      if (auf) feld.removeAttribute("hidden"); else feld.setAttribute("hidden", "");
      knopf.setAttribute("aria-expanded", auf ? "true" : "false");
    });
  }

  /* ---------- Sechste Sektion: warum es diese App gibt ------------------------------------
     Vier Zahlen und eine Kurve zur Verschiebung der Suche. JEDE Zahl ist belegt, und die Quelle
     steht IM BILD -- nicht in einem Kommentar, den niemand liest. Das ist hier keine Formsache:
     eine Landingpage, die Marktzahlen ohne Herkunft behauptet, ist an genau der Stelle unglaubwuerdig,
     an der sie ueberzeugen soll.

     Die vier Zahlen, jede an ihrer Primaerquelle geprueft:
     - 900 Mio. woechentliche ChatGPT-Nutzer. OpenAI am 27.02.2026, berichtet von TechCrunch
       ("ChatGPT has reached 900 million weekly active users, OpenAI announced Friday").
     - Ueber 1 Mrd. monatliche Nutzer von Googles AI Mode. Sundar Pichai in den Bemerkungen zum
       Quartalsbericht Q2 2026 auf blog.google: "Since expanding AI Mode globally last October,
       we have surpassed 1 billion monthly active users."
     - 8 Prozent gegen 15 Prozent. Pew Research Center, 22.07.2025, aus dem Surfverhalten von 900
       US-Erwachsenen im Maerz 2025 (68.879 Google-Suchen): mit KI-Zusammenfassung wurde in 8
       Prozent der Besuche ein Suchergebnis angeklickt, ohne in 15.
     - Plus 1.200 Prozent Verweisverkehr. Adobe Analytics, 17.03.2025: der Verkehr von
       generativer KI auf US-Handelsseiten lag im Februar 2025 um 1.200 Prozent ueber Juli 2024.

     Die Kurve zeigt die woechentlichen ChatGPT-Nutzer, weil das die einzige Reihe ist, die ueber
     Jahre aus OFFIZIELLEN Ansagen desselben Anbieters besteht -- 100 Mio. (Nov 2023), 200 (Aug
     2024), 300 (Dez 2024), 400 (Feb 2025), 700 (Aug 2025), 800 (Okt 2025), 900 (Feb 2026). Eine
     zusammengesuchte Marktschaetzung waere eine Kurve aus fremden Annahmen.
     Die drei Marken darauf sind datierte Ereignisse und keine Deutungen: die Freigabe der AI
     Overviews fuer alle in den USA (Google I/O, Mai 2024), die Oeffnung des AI Mode fuer alle in
     den USA (Google I/O, Mai 2025) und sein weltweiter Start (Oktober 2025, aus Pichais
     Bemerkungen zum Quartalsbericht). Alle drei stehen auf blog.google. */
  var GEO_CHIP = "Why now";
  var GEO_H1 = "Search moved.";
  var GEO_H2 = "Your buyers ask an assistant, and it answers from pages it picked.";
  /* Die Herkunft steht NICHT mehr im Bild -- sie steht hier. Jede der vier Zahlen ist oben an ihrer
     Primaerquelle geprueft, mit Datum und Wortlaut; wer sie aendert, aendert sie dort mit. */
  var GEO_KPIS = [
    { v: "900M", l: "weekly ChatGPT users" },
    { v: "1B+", l: "monthly users of Google's AI Mode" },
    { v: "8%", l: "of searches with an AI summary end in a click - against 15% without one" },
    { v: "+1,200%", l: "referral traffic from AI to US retail sites in seven months" }
  ];
  /* Monate seit November 2023 und woechentliche Nutzer in Millionen. */
  var GEO_PUNKTE = [[0, 100], [9, 200], [13, 300], [15, 400], [21, 700], [23, 800], [27, 900]];
  var GEO_MARKEN = [
    { x: 6,  t: "May 2024", s: "AI Overviews for everyone in the US" },
    { x: 18, t: "May 2025", s: "AI Mode opens to the US" },
    { x: 23, t: "Oct 2025", s: "AI Mode goes global" }
  ];

  /* Die Kurve als SVG und nicht ueber das Chart-Kit: das Kit zeichnet Karten mit Achsen, Legende
     und Tooltip -- hier steht eine Linie als Grund der Sektion, ohne Kasten und ohne Bedienung.
     Dieselbe Entscheidung wie bei den Bahnen der Modelle: ein eigenes Bild, kein verkleinertes
     Bauteil.
     Die Kurve laeuft durch die Punkte mit Catmull-Rom-Glaettung, in Bezier umgerechnet. Eine
     Gerade von Punkt zu Punkt saehe aus wie ein Chart, das keines ist; eine frei gezeichnete Kurve
     waere eine erfundene Form. So ist es die Reihe, nur weich. */
  function geoPfad(pkt, breite, hoehe){
    var xMax = 27, yMax = 1000;
    var P = pkt.map(function(p){
      return [p[0] / xMax * breite, hoehe - p[1] / yMax * hoehe];
    });
    var d = "M" + P[0][0].toFixed(1) + " " + P[0][1].toFixed(1);
    for (var i = 0; i < P.length - 1; i++){
      var p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," + c2x.toFixed(1) + " " +
           c2y.toFixed(1) + "," + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }

  function geoChart(){
    var B = 1000, H = 420;
    var d = geoPfad(GEO_PUNKTE, B, H);
    return '<svg class="ulh-geo-svg" viewBox="0 0 ' + B + ' ' + H + '" preserveAspectRatio="none" ' +
      'aria-hidden="true" focusable="false">' +
      '<defs><pattern id="ulhGeoRaster" width="8" height="8" patternUnits="userSpaceOnUse">' +
        '<line x1="0" y1="0" x2="0" y2="8" class="ulh-geo-raster"/></pattern></defs>' +
      /* Die Flaeche unter der Kurve ist schraffiert und nicht gefuellt: gefuellt legt sie sich als
         Block hinter die Zahlen, schraffiert bleibt der Text lesbar. */
      '<path class="ulh-geo-flaeche" d="' + d + 'L' + B + ' ' + H + 'L0 ' + H + 'Z"/>' +
      '<path class="ulh-geo-linie" d="' + d + '"/>' +
    '</svg>';
  }

  /* Wo liegt die Kurve bei diesem Monat? Der Punkt der Marke soll AUF der Linie sitzen, und die
     Linie ist geglaettet -- zwischen zwei Messpunkten liegt sie also nicht auf der Geraden. Also
     wird das Stueck, in dem der Monat liegt, abgetastet und der Wert genommen, dessen x am
     naechsten liegt. Sechzig Schritte je Stueck: der Fehler ist damit kleiner als ein Pixel. */
  function geoY(xm){
    var B = 1000, H = 420;
    var d = null;
    var P = GEO_PUNKTE.map(function(p){ return [p[0] / 27 * B, H - p[1] / 1000 * H]; });
    var ziel = xm / 27 * B, besteX = 1e9, besteY = P[0][1];
    for (var i = 0; i < P.length - 1; i++){
      var p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      for (var k = 0; k <= 60; k++){
        var t = k / 60, u = 1 - t;
        var x = u*u*u*p1[0] + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*p2[0];
        var y = u*u*u*p1[1] + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*p2[1];
        var ab = Math.abs(x - ziel);
        if (ab < besteX){ besteX = ab; besteY = y; }
      }
    }
    return (H - besteY) / H;      /* Anteil von unten, 0 bis 1 */
  }

  function geoMarkenHtml(){
    return GEO_MARKEN.map(function(m, k){
      var y = geoY(m.x);
      var links = (m.x / 27 * 100).toFixed(2) + '%';
      /* Zwei Teile, weil sie an verschiedenen Kanten haengen: die gestrichelte Linie steht am
         BODEN des Charts und ist so hoch wie der Punkt plus 64px -- deshalb sind alle drei
         verschieden lang. Marke und Beschriftung haengen am Punkt selbst.
         64px ist der Abstand, den die Beschriftung von der Kurve haelt: darunter lief sie durch
         die Schraffur, und an der tiefen ersten Marke sogar unter die Linie. */
      return '<span class="ulh-geo-mk-linie" style="left:' + links +
        ';height:calc(' + (y * 100).toFixed(2) + '% + 64px)"></span>' +
        /* --auf ist hier der reine Zaehler 0,1,2 -- die Marken stehen in GEO_MARKEN nach Datum,
           also von links nach rechts, und ihren Vorlauf gegenueber der Kurve traegt die Regel in
           der CSS (.ulh-geo-mk.ulh-auf). Vorher stand hier k+2 und damit der Takt der ganzen
           Seite; drei Punkte auf einer breiten Kurve brauchen mehr Pause dazwischen. */
        '<span class="ulh-geo-mk ulh-auf" style="left:' + links +
        ';bottom:' + (y * 100).toFixed(2) + '%;--auf:' + k + '">' +
        '<span class="ulh-geo-mk-txt">' +
          '<span class="ulh-geo-mk-t">' + m.t + '</span>' +
          '<span class="ulh-geo-mk-s">' + m.s + '</span>' +
        '</span>' +
        '<span class="ulh-geo-mk-punkt"></span>' +
      '</span>';
    }).join("");
  }

  function geo(){
    return '<section class="ulh-geo">' +
      '<div class="ulh-spur ulh-geo-in">' +
        '<div class="ulh-feat-kopf ulh-geo-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + GEO_CHIP + '</span>' +
          '<h2 class="ulh-feat-h ulh-geo-h">' + GEO_H1 +
            '<span class="ulh-geo-h2"> ' + GEO_H2 + '</span></h2>' +
        '</div>' +
        '<div class="ulh-geo-kpis">' +
          GEO_KPIS.map(function(k, i){
            return '<div class="ulh-geo-kpi ulh-auf" style="--auf:' + i + '">' +
              '<span class="ulh-geo-v">' + k.v + '</span>' +
              '<span class="ulh-geo-l">' + k.l + '</span>' +
            '</div>';
          }).join("") +
        '</div>' +
      '</div>' +
      /* Die Kurve steht im Fluss und nicht absolut: so ist der Abstand zu den Zahlen eine Zahl
         und keine Rechnung aus zwei Kanten, und ihr unteres Ende liegt genau auf der Linie, die
         die Sektion abschliesst. */
      '<div class="ulh-geo-bild">' + geoChart() + geoMarkenHtml() + '</div>' +
    '</section>';
  }

  /* ---------- Fuenfte Sektion: Mira bei der Arbeit ----------------------------------------
     Links drei Karten, rechts Mira -- und rechts steht die ECHTE Komponente, nicht ihr Bild.

     WARUM in einem eigenen Dokument: ask-mira ist an die Kennung #ask-mira gebunden. 268 Regeln in
     ask-mira.css haengen daran, im Markup stecken 57 weitere Kennungen, und ask-mira.js sucht seine
     Wurzel mit getElementById. Diese eine Instanz ist auf der Seite schon vergeben -- sie ist die
     zweite Szene des Hero-Fensters. In einem iframe ist die Kennung wieder eindeutig, und damit
     laeuft hier dieselbe Komponente, die die App zeigt: dieselbe Blase, dieselben Chips, dieselbe
     Tabelle, dasselbe Arbeitsprotokoll beim Laden.

     Gefuehrt wird sie von HIER aus, ueber ihre eigenen Setter im Fenster des iframes -- genau die
     Folge, die auch die Mira-Szene im Hero benutzt: tippen, Knopf druecken, Nachricht setzen,
     Werkzeuge melden, Antwort nachschieben, tippen lassen. Nichts davon ist nachgebaut. */
  /* Die drei Karten beantworten eine einzige Frage: wozu ein Agent, wenn es Dashboards gibt.
     Also nicht, was Mira technisch tut, sondern was der Unterschied ist -- fragen statt suchen,
     nachpruefbar statt behauptet, Entscheidung statt Diagramm. */
  var MSC_KARTEN = [
    { ic: "zap", t: "Ask instead of digging.",
      s: "No filters to set, no dashboards to assemble. Ask in plain words and get the answer " +
         "with the numbers behind it." },
    { ic: "telescope", t: "It shows its work.",
      s: "Every claim carries the prompt, the model and the page it came from. Open any of them " +
         "and check it yourself." },
    { ic: "listTodo", t: "It ends in a decision.",
      s: "Not a chart to interpret: the next step, what it is worth, and where to start." }
  ];

  /* Die drei Faelle. Sie zeigen, was eine Antwort ENTHAELT und nicht, wie lang sie sein kann:
     ein Satz mit Sentiment-Auszeichnung, eine Liste mit Quellen- und Markenchips, eine Tabelle.
     Der Report fehlt mit Absicht -- den zeigt das Hero-Fenster oben schon.
     Die Werkzeuge sind die echten Namen aus ask-mira.js (_TOOL_STATE); aus ihnen baut die
     Komponente ihr Arbeitsprotokoll waehrend des Ladens, mit Zeichen und Text je Schritt. */
  function mscFaelle(){
    return [
      /* DER ERSTE FALL ZEIGT DAS ADD-DROPDOWN (29.09. spaet angefordert: "Add-Dropdown auf, kurz
         ohne Eingabe sichtbar, also der Ruhezustand, dann wird etwas gesucht und gefragt"). wahl
         ist das Wort, das im Dropdown gesucht wird; der erste Treffer wird uebernommen und steht
         als Bezug im Feld, bevor die Frage getippt wird.
         SEIT DEM 30.09. EINE DOMAIN und keine Marke: "forbes" findet in den Demodaten genau eine
         Zeile, die Domain forbes.com (Marken und Prompts treffen nicht), und die Frage ist die, die
         Mira selbst zu einer Domain vorschlaegt (ask-mira.js, "What can you tell me about this
         domain?"). Die Zahlen sind die der Quellen-Demodaten: 18.4% Anteil (+2.1), 2,926
         Zitate, Editorial, 42 Seiten; die Seite und die Chance stehen so auch im Chancen-Brett. */
      { wahl: "forbes", q: "What can you tell me about this domain?",
        titel: "forbes.com at a glance",
        werkzeuge: ["citation_overview", "url_detail"],
        dauer: 16000,
        belege: [{ id: "ev-d1", type: "domain", entity_id: "d1", domain: "forbes.com",
                   title: "forbes.com", icon_url: quellzeichen("forbes.com"), action: "open_domain" }],
        html: '<p>' + miraChip("domain", "d1", "forbes.com") + ' is an <strong>Editorial</strong> ' +
          'source and one of the most cited in your market: <strong>18.4%</strong> of all ' +
          'citations, up 2.1 points, across <strong>42 pages</strong>.</p><ul>' +
          '<li>Its most cited page is the buyer guide on ' + quelleChip(0) + '. It names ' +
          markeChip("bm") + ' and ' + markeChip("au") + ', not you.</li>' +
          '<li>That page feeds five of your comparison prompts.</li>' +
          '</ul><p>Getting ' + markeChip("ac") + ' into that guide is your biggest opening here.</p>' },

      { q: "What are people saying about Acme right now?",
        titel: "Sentiment, last 30 days",
        werkzeuge: ["brand_overview", "source_mentions_overview"],
        dauer: 14000,
        html: '<p>' + markeChip("ac") + ' sits at <strong>79 / 100</strong> sentiment over the last ' +
          '30 days, up 3.1 points. The praise is consistent:</p>' +
          '<p><span data-mira-sentiment="positive">"The Acme is the quietest of the three on the ' +
          'motorway, and the only one that hit its stated range in our winter test."</span></p>' +
          '<p>The quote is from ' + miraChip("response", "r1", "ChatGPT, Aug 24") +
          '; most of the positive mentions trace back to ' + quelleChip(0) + '.</p>' },

      { q: "What should I fix first this week?",
        titel: "This week's priorities",
        werkzeuge: ["prompt_insights", "source_recommendations"],
        dauer: 21000,
        html: '<p>Three things, highest lift first:</p><ul>' +
          '<li>Get the estate into the range tests on ' + quelleChip(0) +
          ' - they decide five of your comparison prompts.</li>' +
          '<li>Answer the charging thread on ' + quelleChip(1) + ' - ' + markeChip("bm") +
          ' is named there, you are not.</li>' +
          '<li>Publish real winter range figures: your weakest topic at <strong>22%</strong>.</li></ul>' +
          '<p>Estimated lift: <strong>+5 to 8 points</strong> in 30 days.</p>' },

      { q: "Which sources decide who gets named?",
        titel: "Sources behind the answers",
        werkzeuge: ["citation_overview", "response_mentions"],
        dauer: 18000,
        /* Der Satz steht VOR der Tabelle und nicht dahinter: eine Zeile statt zwei, und die
           Antwort passt damit in die Chatflaeche. Nach der Tabelle brauchte er zwei Zeilen. */
        html: '<p>Two pages decide most of it, and neither is yours:</p>' +
          '<table><thead><tr><th>Source</th><th>Share</th><th>Names</th></tr></thead><tbody>' +
          '<tr><td>' + quelleChip(0) + '</td><td>31.4%</td><td>' + markeChip("bm") + '</td></tr>' +
          '<tr><td>' + quelleChip(1) + '</td><td>18.2%</td><td>' + markeChip("au") + '</td></tr>' +
          '</tbody></table>' }
    ];
  }

  var MSC_CHIP = "Agentic AEO";
  var MSC_H = "An analyst, not a dashboard";
  var MSC_SUB = "Ask in your own words and Mira does the work: it reads your prompts, responses " +
    "and sources, shows where every number comes from, and says what to do next.";

  function msc(){
    return '<section class="ulh-msc">' +
      '<div class="ulh-spur">' +
        /* Derselbe Kopf wie ueber den Karten -- gleiche Klassen, gleiche Masse, gleiche Farben.
           Ein zweiter Kopf mit eigenen Werten waere derselbe Kopf, nur ein bisschen anders. */
        '<div class="ulh-feat-kopf ulh-msc-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + MSC_CHIP + '</span>' +
          '<h2 class="ulh-feat-h">' + MSC_H + '</h2>' +
          '<p class="ulh-feat-sub">' + MSC_SUB + '</p>' +
        '</div>' +
        /* Derselbe Kasten und dieselben Karten wie im Block darueber -- Bauteile verwenden, nicht
           nachbauen. Neu ist allein die Aufteilung 20 zu 80. */
        '<div class="ulh-cards-box ulh-msc-box">' +
          '<div class="ulh-cards-row ulh-msc-row">' +
            '<div class="ulh-msc-links">' +
              MSC_KARTEN.map(function(k, i){
                return '<div class="ulh-card ulh-msc-karte ulh-auf" style="--auf:' + i + '">' +
                  '<span class="ulh-msc-ic" data-ic="' + k.ic + '" data-ic-w="1.6"></span>' +
                  '<span class="ulh-msc-t">' + k.t + '</span>' +
                  '<span class="ulh-msc-s">' + k.s + '</span>' +
                '</div>';
              }).join("") +
            '</div>' +
            '<div class="ulh-card ulh-msc-rechts ulh-auf ulh-auf-gross" style="--auf:1">' +
              '<iframe class="ulh-msc-rahmen" title="Mira" scrolling="no"' +
                ' referrerpolicy="no-referrer"></iframe>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* Die Adresse, aus der die Seite geladen wurde -- das iframe braucht ABSOLUTE Adressen: seine
     eigene Basis ist "about:srcdoc", und relative Pfade laufen dort ins Leere. Drei Wege: das
     Skript, das diese Datei geladen hat, sonst der Lader, sonst das Verzeichnis der Seite selbst
     (der Fall im Messaufbau, wo die Dateien als Text eingehaengt werden und keine Adresse haben). */
  function mscBasis(){
    var s = document.querySelector('script[src*="landing-hero.js"], script[src*="landing-boot.js"]');
    var src = s && s.src;
    if (src) return src.slice(0, src.lastIndexOf("/") + 1);
    return location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
  }

  /* srcdoc und keine zweite HTML-Datei: die Dateiliste der Seite steht in landing-boot.js, und
     eine zweite Datei waere ein zweiter Ort, an dem ein Pin veralten kann. */
  function mscSeite(){
    var basis = mscBasis();
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="' + basis + 'core.css">' +
      '<link rel="stylesheet" href="' + basis + 'ask-mira.css">' +
      '<style>' +
        'html,body{margin:0;padding:0;background:#ffffff;overflow:hidden;}' +
        '#ask-mira{height:100vh;}' +
        /* Der Knopf "All Chats" fuehrt in eine Liste, die es hier nicht gibt. */
        '#am-open-prev{display:none;}' +
        /* Der Startbildschirm ist NUR Kopf und Eingabefeld: keine Kategorien, kein Hinweis
           darunter. Beides gehoert in die App, wo man damit weiterklickt -- hier ist es Text, den
           niemand braucht, und er nimmt die Ruhe aus dem Bild. */
        '#am-suggested{display:none;}' +
        '.am-hint{display:none;}' +
        /* Der Kopf ist hier eine Signatur und keine Statuszeile: kleiner Schriftzug, kein
           Bereitschaftszeichen, kein Untertitel. In der App sagen die beiden etwas (laeuft gerade
           etwas? worueber rede ich hier?) -- in einer Vorfuehrung sagen sie nichts. */
        '.am-status-pill{display:none;}' +
        '.am-subline{display:none;}' +
        /* Zeichen 16x16, 8px Abstand, dann der Schriftzug -- und beide auf einer Mittellinie.
           Die Hoehe des SVG zieht im Verhaeltnis mit (20/19 -> 16/15.2): das Zeichen ist nicht
           quadratisch, und eine glatte 16 in beiden Massen haette es gestaucht.
           Der Versatz von 1px, den das Zeichen in der App traegt, faellt hier weg: er gleicht dort
           eine groessere Schrift aus. */
        '.am-brand{gap:8px;align-items:center;}' +
        '.am-logo-mark,.am-logo-mark.is-icon{width:16px;height:16px;transform:none;}' +
        /* MIT .is-icon: ask-mira.css setzt ".am-logo-mark.is-icon svg" auf 26x26, und das sind
           zwei Klassen gegen die eine hier. Genau daran ist die Verkleinerung vorher gescheitert
           -- der Kasten wurde kleiner, das Zeichen darin blieb 26px und stand ueber ihn hinaus
           (gemessen: Kasten 16x16, SVG 26x26). Quadratisch, weil die Icon-Fassung quadratisch ist. */
        '.am-logo-mark.is-icon svg,.am-logo-mark svg{width:16px;height:16px;}' +
        '.am-wordmark{font-size:21px;line-height:1;}' +
        /* Weniger Luft zwischen Frage und Arbeitsprotokoll, mehr zwischen Protokoll und Antwort:
           das Protokoll gehoert zur Frage (es ist die Arbeit daran) und nicht zur Antwort. */
        '.am-messages{gap:24px;}' +
        '.am-run:not(.is-live){margin-bottom:24px;}' +
        /* KEIN Scrollen in der Komponente: die Seite scrollt, das Bauteil nicht. Das Nachfuehren
           an das Ende der Antwort macht Mira selbst ueber scrollTop, und das geht auch bei
           overflow: hidden. */
        /* Zwei Kennungen, damit es ueber die Spezifitaet gewinnt und nicht ueber die Reihenfolge:
           ask-mira.css setzt overflow-y: auto ueber "#ask-mira:not(.has-messages) .am-chat", und
           eine Klasse allein verliert dagegen. Gemessen: mit .am-chat stand overflow weiter auf
           auto. */
        '#ask-mira #am-chat{overflow:hidden;}' +
        /* Und der Chat nimmt gar keine Zeigerereignisse mehr an. Das Abfangen des Rades allein
           reichte nicht: ask-mira haengt ZWEI Radgriffe an (einen davon in der Einfangphase am
           Root), und wer darauf setzt, dass die eigene Reihenfolge gewinnt, hat eine Wette und
           keine Loesung. Ohne Zeigerereignisse landet das Rad am Dokument, das nicht scrollen kann
           -- und der Browser reicht es an die Seite darueber weiter.
           Was dabei verloren geht, ist das Hovern IN der Antwort (Chips, Knopfreihe). Auf dem
           Startbildschirm und am Eingabefeld bleibt es, und die stehen ausserhalb des Chats. */
        '#ask-mira #am-chat{pointer-events:none;}' +
        /* Die Zeile mit Kopieren, Daumen und Export steht in der App erst beim Ueberfahren der
           Nachricht da. Hier faehrt niemand darueber, also steht sie immer -- sonst fehlt sie in
           der Vorfuehrung ganz. */
        '.am-msg-actions{opacity:1;transform:none;pointer-events:auto;}' +
        '.am-msg.am-typing .am-msg-actions{opacity:0;}' +
        /* Fokusrahmen und Knopfdruck: dieselben zwei Regeln, die im Hero-Fenster stehen
           (landing-hero.css). Sie muessen hier NOCH EINMAL stehen, weil das iframe landing-hero.css
           nicht laedt -- es laedt nur core.css und ask-mira.css. */
        '.am-composer.is-tippt{border-color:color-mix(in srgb,var(--up-focus) 50%,var(--am-border));' +
        'box-shadow:0 0 0 var(--up-focus-w) color-mix(in srgb,var(--up-focus-ring) 50%,transparent),' +
        'var(--am-shadow-sm);}' +
        '.am-send{transition:transform 260ms cubic-bezier(.4,0,.2,1),' +
        'background 260ms cubic-bezier(.4,0,.2,1);}' +
        '.am-send.is-klick{transform:scale(.9);background:#585855;}' +
        /* DAS EINGABEFELD SCHREIBT WIE DIE NACHRICHT (28.09. angefordert, dieselbe Regel wie im
           Hero-Fenster, landing-hero.css). Hier steht Mira in ihrer App-Groesse: die Blasen bei
           16px und Zeilenhoehe 1.7 (ask-mira.css, .am-bubble), das Feld bei 14px und 1.5 -- und
           genau das sieht man, wenn die getippte Frage in den Chat wandert. Familie, Schnitt,
           Laufweite und Farbe stimmten gemessen schon ueberein, gesetzt werden nur die zwei Werte,
           die abwichen.
           Der laufende Platzhalter geht mit: er liegt genau ueber der Zeile, in der danach getippt
           wird, und zwischen den Faellen steht er dort. Bliebe er bei 14px, spraenge die Schrift
           beim ersten getippten Zeichen. Sein Kasten waechst dafuer auf eine Zeile der neuen
           Hoehe (16 x 1.7 = 27.2, also 28 statt 22) -- sonst schnitte er die Unterlaengen ab.
           Mit der Kennung: ask-mira.css setzt beide Groessen je zweimal (Grundregel und schmales
           Fenster), und diese Regeln sollen ueber die Spezifitaet gewinnen. */
        '#ask-mira .am-textarea,#ask-mira .am-ph-text{font-size:16px;line-height:1.7;}' +
        '#ask-mira .am-ph-loop{height:28px;}' +
        /* DAS ADD-DROPDOWN KLEINER, in zwei Runden. 29.09. spaet die Trefferliste ("Schriften
           und Logos erscheinen mir da zu gross"), 30.09. das ganze Dropdown noch einmal ("font
           sizes und logo sizes etwas kleiner", dazu die Namen 100 leichter und kein grauer Grund
           hinter dem Logo). Jedes Mass geht eine Stufe herunter, und was zu einem Mass gehoert,
           zieht mit -- sonst stoesst Schrift an ihren Kasten (CLAUDE.md, Paragraph 1):
             Suchzeile     Text 14 -> 13, Lupe 17 -> 16
             Befehlschips  die Masse von .up-entchip.is-lifted.is-sm aus core, Wert fuer Wert:
                           22 hoch, Radius 6.4, Luecke 5.5, Polster 5.5/8.25, Schrift 11. Das ist
                           die kleine Fassung, die die Palette schon traegt (.mqa-mini) -- eine
                           dritte Groesse dazwischen waere ein neues Bauteil.
             Faecher       per zoom 0.875, weil seine Karten auf einem gerechneten Bogen stehen
                           (transform-origin 50% 440%): Karte 32 -> 28, Logo 20 -> 17.5, und der
                           Bogen schrumpft mit, statt dass die Karten sich anders ueberlappen.
                           Die Unterschrift 13 -> 12 eigens, sie steht nicht im Faecher.
             Trefferzeile  Name 12 -> 11, Nebenzeile, Typ und Gruppenkopf 11 -> 10, Kachel
                           24 -> 20 (Radius 6 -> 5, Flagge 20x15 -> 16x12, Rueckfallzeichen
                           13 -> 11), Polster senkrecht 7 -> 6, Luecke 9 -> 8. Das Skelett, das
                           waehrend der Suche an ihrer Stelle steht, bekommt dieselben Masse --
                           sonst springt die Liste, wenn die Treffer kommen.
           DER NAME 100 LEICHTER: 500 -> 400, und der getippte Teil darin 700 -> 600. Beide, weil
           "BMW" ganz aus getipptem Teil besteht -- der sichtbare Name ist der Treffer.
           KEIN GRUND HINTER EINEM LOGO: Fuellung und Rahmen der Kachel fallen, sobald ein Bild
           darin steht. Ohne Bild (.is-fb) bleibt die Kachel -- dort traegt sie das Ersatzzeichen.
           Seitlich bleiben die 10 der Zeile: .am-pick-scroll holt genau diese 10 mit einem
           negativen Rand wieder herein (ask-mira.css), damit der Text mit dem Suchfeld darueber
           fluchtet.
           Nur hier: in der App bleibt das Dropdown, wie es ist. */
        '#ask-mira .am-pick-input{font-size:13px;}' +
        '#ask-mira .am-pick-sic{width:16px;height:16px;}' +
        '#ask-mira .am-pick-cmd{height:22px;gap:5.5px;padding:0 5.5px 0 8.25px;border-radius:6.4px;font-size:11px;}' +
        '#ask-mira .up-fan{zoom:.875;}' +
        '#ask-mira .up-fan-cap{font-size:12px;}' +
        '#ask-mira .am-pick-cgroup{padding:3px 0 2px;}' +
        '#ask-mira .am-pick-cgroup+.am-pick-cgroup{margin-top:7px;}' +
        '#ask-mira .am-pick-cghead{padding:4px 10px 3px;font-size:10px;}' +
        '#ask-mira .am-pick-row{padding:6px 10px;gap:8px;}' +
        '#ask-mira .am-pick-av{width:20px;height:20px;border-radius:5px;}' +
        '#ask-mira .am-pick-av:not(.is-fb){background:transparent;border:0;}' +
        '#ask-mira .am-pick-av.is-flag{width:16px;height:12px;border-radius:2px;}' +
        '#ask-mira .am-pick-av-fb svg{width:11px;height:11px;}' +
        '#ask-mira .am-pick-primary{font-size:11px;font-weight:400;}' +
        '#ask-mira .am-pick-hl{font-weight:600;}' +
        '#ask-mira .am-pick-secondary{font-size:10px;}' +
        '#ask-mira .am-pick-type{font-size:10px;}' +
        '#ask-mira .am-pick-sk{gap:8px;padding:6px 10px;}' +
        '#ask-mira .am-pick-sk-av{width:20px;height:20px;border-radius:5px;}' +
        '#ask-mira .am-pick-sk-lines{gap:5px;}' +
        '#ask-mira .am-pick-sk-line{height:8px;}' +
      '</style></head><body>' + (MARKUP.mira || "") +
      /* DIE VORFUEHRUNG NIMMT NIE DEN FOKUS (01.10. gemeldet: "bis zum Domain Detail
         runtergescrollt, dann springt es auf einmal zum Mira Standalone"). Mira fokussiert beim
         Oeffnen des Add-Dropdowns das Suchfeld und nach einem Bezug das Eingabefeld -- in der App
         richtig. In einem iframe zieht focus() aber das Fenster DARUEBER mit: der Browser scrollt
         die Seite, bis das Feld zu sehen ist. Gemessen: von 4900 auf 6171, sobald der Rahmen
         geladen war, und danach in jedem Durchgang wieder, egal wo man gerade liest.
         Kein focus({ preventScroll }) statt dessen: der Fokus laege dann trotzdem im iframe, und
         dort sperrt die Vorfuehrung jede echte Taste (unten) -- Leertaste und Pfeile bewegten die
         Seite nicht mehr. Hier bedient niemand etwas, also braucht auch nichts den Fokus. Vor
         core.js, damit es fuer jeden Aufruf gilt, auch fuer einen beim Start. */
      '<script>HTMLElement.prototype.focus=function(){};<\/script>' +
      '<script src="' + basis + 'core.js"><\/script>' +
      '<script src="' + basis + 'ask-mira.js"><\/script>' +
      '<script>' +
        /* HELL, und ueber den Setter: ask-mira.js nimmt data-theme beim Start ab und faellt sonst
           auf prefers-color-scheme zurueck -- auf einem dunkel gestellten Rechner stuende hier
           sonst eine schwarze Komponente in einer hellen Seite. Die Schleife, weil der Setter erst
           existiert, wenn ask-mira.js gelaufen ist. */
        '(function(){var n=0;(function go(){if(window.askMiraSetTheme){' +
        'window.askMiraSetTheme("light");return;}if(n++<60)setTimeout(go,50);})();})();' +
        /* DAS ADD-DROPDOWN OEFFNET NACH UNTEN (29.09. spaet angefordert). Das Feld steht hier auf
           dem Startschirm im oberen Drittel, weil Kategorien und Hinweis ausgeblendet sind --
           unter ihm ist Platz, ueber ihm steht die Begruessung. is-pick-unten ist Miras eigener
           Schalter dafuer (ask-mira.css, pickDeckel in ask-mira.js); er gilt nur ohne
           Nachrichten, im Chat steht das Feld wieder unten. Die Zeile laeuft nach ask-mira.js,
           also steht die Wurzel schon da -- und das Dropdown ist noch zu, es springt nichts. */
        '(function(){var m=document.getElementById("ask-mira");if(m)m.classList.add("is-pick-unten");})();' +
        /* Sehen ja, bedienen nein -- in der Abfangphase, bevor die Komponente es sieht. Ein
           pointer-events: none am Rahmen haette auch das Hovern mitgenommen. */
        /* Das Mausrad gehoert der SEITE. ask-mira haengt einen eigenen Radgriff an den Chat, der
           scrollt und dann preventDefault ruft -- in der App richtig, hier steht damit alles: der
           Chat scrollt nicht (er passt), und die Seite darunter auch nicht mehr. Der Griff wird in
           der Einfangphase gestoppt, bevor er ueberhaupt laeuft; ohne preventDefault reicht der
           Browser das Rad an das Fenster darueber weiter. */
        'document.addEventListener("wheel",function(e){e.stopPropagation();},true);' +
        /* Nur ECHTE Klicks und Tasten (isTrusted): die Vorfuehrung oeffnet selbst das Add-Dropdown
           und waehlt darin einen Treffer (mscLauf, waehlen) -- ueber el.click(), und das ist nicht
           isTrusted. Der Besucher bleibt ausgesperrt wie bisher. */
        'document.addEventListener("click",function(e){if(!e.isTrusted)return;e.preventDefault();e.stopPropagation();},true);' +
        'document.addEventListener("keydown",function(e){if(!e.isTrusted)return;e.preventDefault();e.stopPropagation();},true);' +
        /* KEINE Tooltips, nirgends -- dieselbe Regel wie im Hero-Fenster (ohneTipps). Die
           Attribute kommen mit jeder neuen Nachricht nach, deshalb ein Beobachter und nicht ein
           einmaliger Durchgang. data-explain gehoert dazu: daran haengt die Erklaerkarte von core,
           und die Belegzeile unter jeder Antwort traegt es. */
        /* Die Reservierung unter der letzten Nachricht sofort zuruecknehmen, nicht in einer
           Schleife. Mira legt sie beim Abschicken an (_pinSendScroll), damit die Frage oben steht
           und die Antwort gleich an ihrer endgueltigen Stelle landet -- ein Verhalten fuer einen
           Chat, in dem man scrollen kann. Hier kann man das nicht, und die Reservierung machte den
           Ausschnitt scrollbar: das war das Zucken beim Eintreffen der Antwort und der Grund,
           warum das Rad ueber der Komponente die Seite nicht mehr bewegte.
           Ein Beobachter und keine Uhr: er greift im selben Bild, in dem die Angabe gesetzt wird.
           Eine Uhr alle 250ms war der zweite Teil des Zuckens. */
        '(function(){function fest(){var l=document.querySelector(".am-messages");' +
        'if(l&&l.style.minHeight&&l.style.minHeight!=="0px")l.style.minHeight="0px";}' +
        'new MutationObserver(fest).observe(document.documentElement,' +
        '{subtree:true,attributes:true,attributeFilter:["style"]});fest();})();' +
        '(function(){var A=["data-tip","data-tiplabel","data-explain"];' +
        'function weg(){for(var i=0;i<A.length;i++){var t=document.querySelectorAll("["+A[i]+"]");' +
        'for(var k=0;k<t.length;k++)t[k].removeAttribute(A[i]);}}weg();' +
        'new MutationObserver(weg).observe(document.documentElement,' +
        '{childList:true,subtree:true,attributes:true,attributeFilter:A});})();' +
      '<\/script></body></html>';
  }

  /* Die Folge je Fall. Dieselbe wie in der Mira-Szene des Hero, nur auf das Fenster des iframes
     gerichtet -- und mit einer Pause am Ende, nach der der naechste Fall beginnt. */
  var MSC_ZEICHEN_MS = 32;     /* Tippgeschwindigkeit -- wie im Hero */
  var MSC_PAUSE_MS   = 700;    /* zwischen fertig getippt und Knopfdruck */
  /* Ein Schritt nach dem anderen, und jeder sichtbar: 1600ms je Werkzeug. Vorher lagen sie so
     dicht, dass der erste noch lief, waehrend die restlichen schon dastanden -- man sah kein
     Arbeiten, sondern eine Liste, die auf einmal da war. Die Ladezeit ergibt sich daraus und ist
     keine eigene Zahl: so viele Schritte, so lange dauert es (plus ein Nachlauf, damit der letzte
     Schritt nicht im selben Moment fertig wird, in dem die Antwort kommt). */
  /* ZWEI Werkzeuge je Fall und nicht drei. Nicht aus Ungeduld: das Arbeitsprotokoll misst 150px
     bei drei Zeilen, und die fehlen unten an der Antwort -- die Karte soll auf ein 13-Zoll-Notebook
     passen. Zwei Werkzeuge plus die Denkzeile sind drei Zeilen, und das liest sich immer noch als
     Arbeit, der man zusieht. */
  var MSC_SCHRITT_MS = 1600;
  var MSC_NACHLAUF_MS = 1400;
  var MSC_HALTEN_MS  = 9600;   /* wie lange die fertige Antwort steht */
  var MSC_LEER_MS    = 900;    /* Ruhe auf dem Startbildschirm vor der naechsten Frage */

  function mscLauf(fr){
    var w, d;
    try { w = fr.contentWindow; d = fr.contentDocument; } catch (e){ return; }
    if (!w || !d) return;
    var faelle = mscFaelle(), i = 0;
    /* Laufnummer. Jeder Durchgang bekommt eine, und jeder Zeitgeber prueft vor dem Zuschlagen, ob
       seine noch die aktuelle ist. Ohne sie treffen zwei Durchgaenge aufeinander, sobald einer von
       aussen angestossen wird (die Handhabe unten) oder das Fenster zwischendurch drosselt: dann
       leert der alte Durchgang den Chat, waehrend der neue schon schreibt. */
    var lauf = 0;
    function planen(meine, fn, ms){
      setTimeout(function(){ if (meine === lauf) fn(); }, ms);
    }

    function tippEreignis(el){
      try { el.dispatchEvent(new w.Event("input", { bubbles: true })); } catch (e){}
    }

    /* Zurueck auf den Startbildschirm. Erst der Ladezustand, dann die Liste: die Chatansicht haengt
       an BEIDEN (messages.length > 0 || isLoading), und mit noch stehendem Ladezustand bliebe sie
       offen. Genau dieselbe Reihenfolge wie im Neustart des Hero-Fensters. */
    function leeren(){
      /* Das Add-Dropdown zu und die Bezuege aus dem Feld: der erste Fall laesst BMW als Pille dort
         stehen, und die gehoert nicht zur naechsten Frage. askMiraClearInput ist der Weg der
         Komponente selbst (Feld, Zitat, Bezuege). */
      var ask = d.getElementById("ask-mira");
      if (ask && ask.classList.contains("is-pick-open")){
        var auf = d.querySelector("#am-pick-btn");
        if (auf) auf.click();
      }
      var suchfeld = d.querySelector("#am-pick-input");
      if (suchfeld && suchfeld.value){ suchfeld.value = ""; tippEreignis(suchfeld); }
      if (w.askMiraClearInput) w.askMiraClearInput();
      /* Das Eingabefeld kommt zurueck, BEVOR Mira es in die Mitte faehrt -- sonst faehrt ein
         unsichtbares Feld. Dieselbe Reihenfolge wie im Neustart des Hero-Fensters. */
      var flaeche = d.querySelector(".am-composer-area");
      if (flaeche){ flaeche.style.display = ""; flaeche.style.opacity = ""; }
      var ta = d.querySelector("#am-textarea");
      var komposer = d.querySelector(".am-composer");
      if (komposer) komposer.classList.remove("is-tippt");
      if (ta){ ta.value = ""; tippEreignis(ta); }
      if (w.askMiraSetLoading) w.askMiraSetLoading("false");
      if (w.askMiraSetMessages) w.askMiraSetMessages([]);
    }

    /* Zeichen fuer Zeichen, mit einem input-Ereignis je Zeichen: daran haengen das Mitwachsen des
       Feldes, der Sendeknopf und die laufende Platzhalterzeile. Ohne das Ereignis stuende Text in
       einem Feld, das nicht mitwaechst, neben einem grauen Knopf. */
    function tippen(meine, text, fertig){
      var ta = d.querySelector("#am-textarea");
      if (!ta){ fertig(); return; }
      var komposer = d.querySelector(".am-composer");
      if (komposer) komposer.classList.add("is-tippt");
      var k = 0;
      (function schritt(){
        if (meine !== lauf) return;
        ta.value = text.slice(0, ++k);
        tippEreignis(ta);
        if (k < text.length) setTimeout(schritt, MSC_ZEICHEN_MS);
        else planen(meine, fertig, MSC_PAUSE_MS);
      })();
    }

    /* Der Knopf federt, bevor die Nachricht rausgeht -- sonst erscheint die Frage aus dem Nichts,
       waehrend der Knopf daneben unberuehrt dasteht. */
    function klicken(meine, fertig){
      /* Der Fokusrahmen faellt MIT dem Knopfdruck ab, nicht erst beim Zuruecksetzen: in der App
         verlaesst man das Feld beim Abschicken. */
      var komposer = d.querySelector(".am-composer");
      if (komposer) komposer.classList.remove("is-tippt");
      var knopf = d.querySelector("#am-send");
      if (!knopf){ fertig(); return; }
      knopf.classList.add("is-klick");
      planen(meine, function(){
        knopf.classList.remove("is-klick");
        planen(meine, fertig, 110);
      }, 130);
    }

    function fall(meine, f){
      var jetzt = new Date().toISOString();
      var frage = { id: "msc-q", role: "user", content: f.q, created_at: jetzt };
      /* f.belege: Belege, die nur dieser Fall braucht (die Domain im ersten Fall). Sie haengen an
         der gemeinsamen Liste, statt in ihr zu stehen -- sonst truege jede Antwort eine Domain in
         ihrer Datenpunktzeile, die im Text nicht vorkommt. */
      var antwort = { id: "msc-a", role: "assistant", status: "success", created_at: jetzt,
                      content_html: f.html, evidence_items: miraBelege().concat(f.belege || []),
                      latency_ms: f.dauer };

      /* Der aktive Chat MUSS stehen, bevor die erste Nachricht kommt: ohne ihn faellt Mira nach
         140ms auf den Startbildschirm zurueck (_maybeHomeIfUnknownChat). Der Titel oben kommt aus
         der Liste der frueheren Chats, nicht aus einem eigenen Setter. */
      if (w.askMiraSetPreviousChats) w.askMiraSetPreviousChats([
        { id: "msc-chat", title: f.titel, updated_at: jetzt }]);
      if (w.askMiraSetTitlePending) w.askMiraSetTitlePending("no");
      if (w.askMiraSetSettings) w.askMiraSetSettings(
        { brand: "logo", citation: "favicon", response: "logo" });
      if (w.askMiraSetActiveChat) w.askMiraSetActiveChat("msc-chat");
      if (w.askMiraSetBrandLogos) w.askMiraSetBrandLogos(MARKEN.map(function(b){
        return { logo_url: b.logo, name: b.name };
      }));
      if (w.askMiraSetMessages) w.askMiraSetMessages([frage]);
      if (w.askMiraSetLoading) w.askMiraSetLoading("true");
      /* Das Eingabefeld geht, kurz bevor die Antwort kommt -- wie im Hero-Fenster. Es hat seine
         Arbeit getan, und die 125px, die es haelt, braucht die Antwort. Ausblenden und danach aus
         dem Fluss nehmen, damit die Antwort nicht in einen Sprung hineinlaeuft. */
      planen(meine, function(){
        var flaeche = d.querySelector(".am-composer-area");
        if (!flaeche) return;
        flaeche.style.transition = "opacity 260ms ease";
        flaeche.style.opacity = "0";
        planen(meine, function(){ flaeche.style.display = "none"; }, 300);
      }, Math.max(0, f.werkzeuge.length * MSC_SCHRITT_MS + MSC_NACHLAUF_MS - 700));

      /* Die Werkzeuge gestaffelt ueber die Ladezeit: daraus baut die Komponente ihr
         Arbeitsprotokoll, eine Zeile je Schritt. Alle auf einmal waeren drei Zeilen in einem Bild
         und keine Arbeit, der man zusieht. */
      f.werkzeuge.forEach(function(name, k){
        planen(meine, function(){
          if (w.askMiraSetTool) w.askMiraSetTool(name);
        }, k * MSC_SCHRITT_MS);
      });
      var denkt = f.werkzeuge.length * MSC_SCHRITT_MS + MSC_NACHLAUF_MS;

      planen(meine, function(){
        /* expectAnswer VOR dem Nachladen, typeLastAnswer danach -- der vorgesehene Weg, wenn eine
           Antwort als komplette Liste kommt: sonst kann die Komponente sie nicht von einem
           geoeffneten Chat unterscheiden und tippt nichts. */
        if (w.askMiraExpectAnswer) w.askMiraExpectAnswer();
        if (w.askMiraSetMessages) w.askMiraSetMessages([frage, antwort]);
        if (w.askMiraTypeLastAnswer) w.askMiraTypeLastAnswer();
        obenHalten(meine);
        /* Drei Messungen waehrend der Haltezeit: Mira baut die Antwort beim Tippen Block fuer
           Block ein, ein einzelner Blick trifft also einen Zwischenstand. */
        [300, 1000, 2000].forEach(function(ms){ planen(meine, hoeheNachfuehren, ms); });
        planen(meine, naechster, MSC_HALTEN_MS);
      }, denkt);
    }

    /* ---- Auf schmalen Schirmen: die Hoehe des Rahmens dem Inhalt nachfuehren ----
       Ein iframe hat immer die Hoehe, die man ihm gibt -- und die feste Hoehe aus der CSS ist fuer
       die Breite eines Notebooks gerechnet. Auf einem Telefon bricht in der Antwort jede Zeile
       zusaetzlich um, also wird der Inhalt hoeher als der Rahmen: gemeldet als "abgeschnitten" und
       "scrollbar im Mobile".
       Statt eine zweite Zahl zu raten, wird der UEBERHANG des Chats gemessen (scrollHeight minus
       clientHeight) und dem Rahmen zugeschlagen. Danach passt der Inhalt genau, und im Chat gibt es
       nichts mehr zu scrollen -- genau das war die Vorgabe.
       Nur nach OBEN und nie zurueck: die drei Faelle sind unterschiedlich lang, und ein Rahmen, der
       zwischen ihnen wieder schrumpft, laesst die Karte auf und ab springen. Er waechst also auf
       den laengsten Fall und bleibt dort. Die Obergrenze ist eine Sicherung gegen eine Messung, die
       aus dem Ruder laeuft (ein Chat, der sich selbst nachscrollt), kein gewuenschtes Mass. */
    var MSC_MOBIL_AT = 900;
    var MSC_MAX_H = 2400;
    function hoeheNachfuehren(){
      if ((window.innerWidth || 0) > MSC_MOBIL_AT) return;
      var chat = d.querySelector(".am-chat");
      if (!chat) return;
      var ueberhang = chat.scrollHeight - chat.clientHeight;
      if (ueberhang <= 2) return;
      var jetzt = fr.offsetHeight || 0;
      if (!jetzt) return;
      var neu = Math.min(MSC_MAX_H, jetzt + ueberhang + 8);
      if (neu > jetzt) fr.style.height = neu + "px";
    }

    /* Frage OBEN, Antwort darunter -- und beides zu sehen.
       Die App macht es anders, und aus gutem Grund: sie heftet die neue Nachricht an den oberen
       Rand und RESERVIERT den Platz darunter (ask-mira.js, _pinSendScroll setzt minHeight an der
       Nachrichtenliste), damit der Ladezustand und spaeter die Antwort gleich an ihrer endgueltigen
       Stelle stehen. Wer die Frage wiedersehen will, scrollt hoch.
       Hier kann niemand hochscrollen -- die Komponente scrollt nicht --, und die Frage gehoert zur
       Vorfuehrung. Also nehmen wir die Reservierung zurueck (dieselbe Inline-Angabe, nur auf 0) und
       halten den Ausschnitt oben. Ein paar Sekunden lang, weil Mira waehrend des Tippens mehrfach
       nachfuehrt. */
    function obenHalten(meine){
      var chat = d.querySelector(".am-chat"), liste = d.querySelector(".am-messages");
      if (liste) liste.style.minHeight = "0px";
      /* Einmal, im naechsten Bild. Ohne Reservierung ist der Inhalt kuerzer als der Ausschnitt,
         also bleibt es danach von selbst oben -- eine Uhr, die alle 250ms nachschiebt, war
         genau das Zucken, das hier weg soll. */
      requestAnimationFrame(function(){
        if (meine !== lauf) return;
        if (chat) chat.scrollTop = 0;
      });
    }

    function naechster(){
      var meine = ++lauf;
      leeren();
      planen(meine, function(){
        var f = faelle[i % faelle.length]; i++;
        function fragen(){ tippen(meine, f.q, function(){ klicken(meine, function(){ fall(meine, f); }); }); }
        if (f.wahl) waehlen(meine, f.wahl, fragen); else fragen();
      }, MSC_LEER_MS);
    }

    /* ---- Das Add-Dropdown vorfuehren (der erste Fall, f.wahl) ----
       Auf, im Ruhezustand stehen lassen (Faecher und "Search your workspace"), das Wort tippen,
       die Treffer stehen lassen, den ersten uebernehmen, zu. Geoeffnet und gewaehlt wird ueber
       die Knoepfe der Komponente selbst (el.click -- die Sperre im iframe laesst nur solche
       Klicks durch), getippt wie die Frage: Zeichen fuer Zeichen mit input-Ereignis, daran haengt
       die Suche. Die Zeiten: die Suche wartet 400ms auf das letzte Zeichen (core,
       makeEntitySearch), die Antwort unten kommt nach 280. */
    var MSC_WAHL_RUHE_MS = 1600;    /* das offene Dropdown ohne Eingabe */
    var MSC_WAHL_ZEICHEN_MS = 110;  /* langsamer als die Frage: drei Buchstaben sollen lesbar ankommen */
    var MSC_WAHL_LISTE_MS = 1100;   /* die Treffer stehen, bevor einer gewaehlt wird */
    var MSC_WAHL_PILLE_MS = 700;    /* der Bezug steht im Feld, dann geht das Dropdown zu */
    function waehlen(meine, wort, fertig){
      var knopf = d.querySelector("#am-pick-btn"), such = d.querySelector("#am-pick-input");
      if (!knopf || !such){ fertig(); return; }
      knopf.click();
      planen(meine, function(){
        var k = 0;
        (function schritt(){
          if (meine !== lauf) return;
          such.value = wort.slice(0, ++k);
          tippEreignis(such);
          if (k < wort.length) setTimeout(schritt, MSC_WAHL_ZEICHEN_MS);
          else planen(meine, nehmen, 400 + 280 + MSC_WAHL_LISTE_MS);
        })();
      }, MSC_WAHL_RUHE_MS);
      function nehmen(){
        /* Mira schreibt beim ersten Bezug eine Vorlage-Frage ins LEERE Feld ("What can you tell me
           about this brand?", frageNachziehen) -- in der App richtig, hier stuende sie eine
           Sekunde da und wuerde dann vom Tippen der eigenen Frage ueberschrieben (gemessen). Und
           abgeschickt truege die Blase den rohen Bezugsblock ("Context: - Brand: BMW (uid: bm)"),
           so zeichnet ihn die App. Ein unsichtbares Zeichen haelt das Feld nicht-leer; das Tippen
           ersetzt es. */
        var ta = d.querySelector("#am-textarea");
        if (ta && !ta.value) ta.value = "\u200B";
        var zeile = d.querySelector("#am-pick-list .am-pick-row[data-esi]");
        if (zeile) zeile.click();
        planen(meine, function(){
          if (d.getElementById("ask-mira").classList.contains("is-pick-open")) knopf.click();
          planen(meine, fertig, 300);
        }, MSC_WAHL_PILLE_MS);
      }
    }

    /* DIE SUCHE DES ADD-DROPDOWNS fragt in der App Bubble (bubble_fn_quick_actions_search) und
       bekommt die Antwort ueber UC.entitySearchDeliver zurueck. Hier gibt es kein Bubble, also
       antwortet die Vorfuehrung selbst -- aus den Demodaten der Seite: Marken, Domains und die
       Prompts der Vorschau. Ohne das stuende nach acht Sekunden "keine Antwort" im Dropdown. */
    w.bubble_fn_quick_actions_search = function(json){
      var anfrage = {};
      try { anfrage = JSON.parse(json); } catch (e){}
      var q = String(anfrage.query || "").trim().toLowerCase();
      if (!q) return;
      function trifft(t){ return String(t || "").toLowerCase().indexOf(q) >= 0; }
      var items = MARKEN.concat(MARKEN_WEITER).filter(function(m){ return trifft(m.name); })
        .map(function(m){ return { type: "brand", id: m.id, name: m.name, logo: m.logo }; })
        .concat(QUELLEN.filter(function(s){ return trifft(s.domain); })
          .map(function(s){ return { type: "domain", domain: s.domain, favicon: s.logo }; }))
        .concat(VIS_ZEILEN.filter(function(z){ return trifft(z.prompt); })
          .map(function(z, k){ return { type: "prompt", id: "lh-p" + k, prompt_text: z.prompt,
                                        market: String(z.markt || "").toLowerCase() }; }));
      setTimeout(function(){
        var U = w.UpstreemCore;
        if (U && U.entitySearchDeliver) U.entitySearchDeliver("results", { requestId: anfrage.requestId, items: items });
      }, 280);
    };
    /* Die Logos fuer den Faecher im Dropdown: dieselben Vorraete wie in der App -- die Marken und
       die Quellen der Seite. Ohne sie zeigte der Faecher im ersten Fall nur Zeichen. */
    function vorraete(){
      if (w.askMiraSetBrandLogos) w.askMiraSetBrandLogos(MARKEN.map(function(b){ return { logo_url: b.logo, name: b.name }; }));
      if (w.askMiraSetFavicons) w.askMiraSetFavicons(QUELLEN.filter(function(s){
        return s.citation_type !== "You" && s.citation_type !== "Brand_Platform"; })
        .map(function(s){ return { favicon_url: s.logo, domain: s.domain }; }));
    }

    /* Handhabe zum Nachsehen: einen Fall sofort zeigen, ohne das Tippen abzuwarten. Sie schreibt
       nichts, was der Lauf nicht ohnehin schriebe -- sie ueberspringt nur die Eingabe. */
    fr.__ulhFall = function(k){ var meine = ++lauf; leeren(); fall(meine, faelle[k % faelle.length]); };
    fr.__ulhFaelle = faelle;     /* zum Nachmessen: die Antworten ohne Lauf und ohne Tippen setzen */

    /* Erst anfangen, wenn die Komponente im iframe wirklich steht. */
    var versuche = 0;
    (function warten(){
      if (d.querySelector("#am-textarea") && w.askMiraSetMessages){ vorraete(); naechster(); return; }
      if (versuche++ < 120) setTimeout(warten, 100);
    })();
  }

  /* Erst laden, wenn die Sektion auf 600px herankommt -- der Seitenaufbau bleibt unberuehrt, das
     zweite core.js laeuft erst, wenn jemand so weit gescrollt hat. */
  function mscFuellen(root){
    var rahmen = root.querySelector(".ulh-msc-rahmen");
    if (!rahmen || rahmen.__ulhAuf) return;
    function laden(){
      if (rahmen.__ulhAuf) return;
      rahmen.__ulhAuf = true;
      rahmen.addEventListener("load", function(){ mscLauf(rahmen); });
      rahmen.srcdoc = mscSeite();
    }
    root.__ulhMsc = laden;       /* Handhabe zum Nachsehen und Messen, wie __ulhSzene */
    if (!window.IntersectionObserver){ laden(); return; }
    var beobachter = new IntersectionObserver(function(eintraege){
      for (var k = 0; k < eintraege.length; k++){
        if (eintraege[k].isIntersecting){ beobachter.disconnect(); laden(); return; }
      }
    }, { rootMargin: "600px 0px" });
    beobachter.observe(rahmen);
  }

  /* ---------- Zweite Sektion: die Kernfunktionen ------------------------------------------
     WAS hier steht und warum genau das -- die Sektion beantwortet die vier Fragen, mit denen
     jemand auf diese Seite kommt, in der Reihenfolge, in der er sie stellt:

       1. "Wo stehe ich?"             -> Sichtbarkeit ueber die Zeit, gegen die Wettbewerber
       2. "Woraus entsteht das?"      -> die Fragen, die in meinem Markt gestellt werden
       3. "Warum steht da der andere?"-> die Quellen, aus denen die Antworten gebaut sind
       4. "Was tue ich jetzt?"        -> die Aufgaben, die daraus folgen

     Das ist bewusst dieselbe Reihenfolge wie die vier Seiten der App und wie die vier Szenen im
     Fenster darueber (Dashboard, Prompt Insights, Citations, Opportunities). Wer die Sektion
     liest und dann oben hinsieht, erkennt jede Karte wieder. Mira fehlt mit Absicht: der Agent
     wird weiter unten getrennt vorgestellt.

     Die TEXTE sind Beschreibungen und keine Werbung. Der erste Entwurf hiess "Know where you
     stand. Know what to fix." und die Karten dazu "See your share of the answer" -- das liest
     sich als Slogan und nicht als Erklaerung. Jetzt sagt jede Zeile, was die App zeigt, in
     Worten, die auch in der App stehen.

     Angesehen habe ich, wie es die Naechstliegenden machen: Peec AI, Profound und Otterly fuehren
     alle drei mit der MESSUNG und enden mit dem HANDELN, und alle drei nennen die Modelle beim
     Namen. Uebernommen ist davon der Bau, kein Satz. */
  /* DIE TEXTE AUF RUND 60 PROZENT (06.10. angefordert: "Texte unter den Headings je auf ca. die
     Haelfte, oder sagen wir 60%"). Gekuerzt um die Erklaerung, nicht um die Aussage: jeder Satz
     sagt weiter, was die Karte zeigt, nur ohne den zweiten Satz, der es noch einmal begruendet. */
  /* NEU GETEXTET NACH EINER RECHERCHE BEI DEN WETTBEWERBERN (06.10. spaet angefordert: "recherchiere
     eine grosse Runde, wie Wettbewerber diese Features bewerben, und orientiere dich stark daran").
     Gelesen: rund 65 Seiten von Profound, Peec, Otterly, AthenaHQ, Scrunch, Ahrefs, Semrush,
     Evertune, Goodie, Gauge, Rankscale, Writesonic, Similarweb, SE Ranking, LLM Pulse, Adthena u. a.
     Was die starken Zeilen dort gemeinsam haben, und was hier uebernommen ist (der Bau, kein Satz):
       - ein Verb vorn (See/Know/Find/Track/Prove), drei bis sieben Woerter, Satzanfang gross
       - die Zeile nennt die FRAGE, die die Karte beantwortet, oder einen Gegner ("who buys your
         prompts") -- nicht die Kennzahlen, die im Bild stehen. Genau daran war "See which products
         move / Rising and falling products, with the change in ..." gescheitert
       - die Unterzeile traegt EIN Merkmal fuer Genauigkeit (exakte URLs, je Markt, taeglich)
     Was die Wettbewerber auf ihren Startseiten NICHT zeigen, steht hier vorn: der Prompt hinter
     jeder Anzeige und die Vergleichsgruppe bei Events. */
  var MERKMALE = [
    { breit: 40, vis: "linie",
      h: "See how often AI recommends you",
      p: "Visibility and position per model, day by day, side by side with your competitors." },
    { breit: 60, vis: "zeilen",
      h: "Know which buyer questions you win",
      p: "Every tracked prompt, grouped by topic, with who gets named and where you land." },
    { breit: 60, vis: "domains",
      h: "See which pages AI trusts most",
      p: "The domains and exact URLs the models cite, so you know where to get mentioned next." },
    { breit: 40, vis: "chancen",
      h: "Your next moves, ranked by priority",
      p: "Every visibility gap becomes a concrete task, with the prompts and numbers behind it." },
    /* Reihe drei, 50/50. Die zwei Karten beantworten die Fragen, die nach den ersten vier kommen:
       "gilt das auch fuer meinen Markt?" und "gilt das fuer alle Modelle?". */
    /* Die Sprachen in der Unterzeile sind die der Vorschau (SPRACHEN: DE, FR, IT neben Englisch). */
    { breit: 50, vis: "sprachen",
      h: "Track every market in its own language",
      p: "Prompts in German, French or Italian, asked from each country, with rankings per market." },
    { breit: 50, vis: "modelle",
      h: "See where the models disagree",
      p: "Your prompts run daily on every major model, showing which ones name you and which don't." }
  ];

  /* ---- Reihe drei, links: Prompts in fuenf Maerkten ----
     Fuenfzehn Prompts, drei je Markt. Die Sprache ist die des Marktes und nicht Englisch mit
     Flagge davor -- der Satz der Karte ("in any language, from any country") wird sonst von seinem
     eigenen Bild widerlegt. Die Volumen sind Schaetzungen in der Groessenordnung, die die App
     zeigt (est. volume, gerundet), und sie fallen mit der Spezialisierung der Frage: eine breite
     Frage wird oefter gestellt als eine enge. */
  /* v ist das geschaetzte Volumen als Wert von 0 bis 100 -- dasselbe Feld, das Prompt Research
     bekommt (estimated_volume), und dargestellt wird es genauso: als vierstufiger Balken, nicht als
     Zahl. Die Stufen dort: bis 25 eine, bis 50 zwei, bis 75 drei, darueber vier. */
  var SPRACHEN = [
    { m: "US", t: "best premium electric SUV for families",             v: 88 },
    { m: "DE", t: "welches E-Auto hat die beste Winterreichweite",      v: 47 },
    { m: "FR", t: "meilleur SUV électrique premium 2026",               v: 39 },
    { m: "GB", t: "which luxury EV charges the fastest",                v: 74 },
    { m: "IT", t: "quale SUV elettrico premium conviene",               v: 24 },
    { m: "US", t: "electric estate with the longest real range",        v: 68 },
    { m: "DE", t: "Premium-SUV leasen oder kaufen",                     v: 36 },
    { m: "FR", t: "break électrique ou SUV électrique",                 v: 29 },
    { m: "GB", t: "company car tax on a plug-in hybrid",                v: 52 },
    { m: "IT", t: "autonomia reale in inverno delle auto elettriche",   v: 18 },
    { m: "US", t: "which brand has the best driver assistance",         v: 61 },
    { m: "DE", t: "Ladeleistung Premium-E-SUV im Vergleich",            v: 21 },
    { m: "FR", t: "quelle voiture électrique garde sa valeur",          v: 16 },
    { m: "GB", t: "safest family SUV on Euro NCAP",                     v: 44 },
    { m: "IT", t: "costi di manutenzione di un'auto elettrica",         v: 12 }
  ];
  /* Der Balken aus Prompt Research, Zeile fuer Zeile derselbe (renderVolume dort): vier Felder,
     gefuellt bis zur Stufe, und die Farbe traegt die Stufe. Nachgebaut ist er hier nur, WEIL die
     Landingpage prompt-research.css nicht laedt -- die vier Regeln dafuer stehen in
     landing-hero.css, mit denselben Werten und demselben Kommentar zur Herkunft. Ein Tooltip
     gehoert nicht dazu: in einem Schaustueck zeigt nichts einen Hinweis. */
  function volumenStufe(v){ return v <= 25 ? 1 : (v <= 50 ? 2 : (v <= 75 ? 3 : 4)); }
  function volumenBalken(v){
    var stufe = volumenStufe(v), aus = "";
    for (var i = 1; i <= 4; i++){
      aus += '<span class="upr-volume-seg' + (i <= stufe ? " is-filled level-" + stufe : "") + '"></span>';
    }
    return '<span class="upr-volume-wrap"><span class="upr-volume-track">' + aus + '</span></span>';
  }

  /* ---- Reihe drei, rechts: die Modelle auf den Umlaufbahnen ----
     Die Zeichen sind die echten Favicons der Anbieter, ueber denselben Weg wie die Quellen
     (quellzeichen) -- ein graues Kaestchen mit Anfangsbuchstaben waere hier dasselbe Raten.
     Die Verteilung auf die drei Bahnen: innen zwei, mitte drei, aussen drei. Innen weniger, weil
     dort der Umfang kleiner ist und drei Zeichen sich sonst beruehren. */
  var ORBIT = [
    { bahn: 0, d: "openai.com",              n: "ChatGPT" },
    { bahn: 0, d: "claude.ai",               n: "Claude" },
    { bahn: 1, d: "gemini.google.com",       n: "Gemini" },
    { bahn: 1, d: "perplexity.ai",           n: "Perplexity" },
    /* copilot.cloud.microsoft und nicht copilot.microsoft.com: die zweite Adresse liefert kein
       Logo, sondern ein leeres schwarzes Kaestchen -- im Bild geprueft, neben den anderen sieben. */
    { bahn: 1, d: "copilot.cloud.microsoft",  n: "Copilot" },
    { bahn: 2, d: "x.ai",                    n: "Grok" },
    { bahn: 2, d: "mistral.ai",              n: "Mistral" },
    { bahn: 2, d: "deepseek.com",            n: "DeepSeek" }
  ];
  /* Die Marke in der Mitte. Dieselbe Datei, die die App als Favicon im hellen Thema fuehrt --
     dunkle Tinte auf durchsichtigem Grund, also genau richtig auf der weissen Scheibe. */
  var ORBIT_MARKE = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/" +
    "BRANDSTYLES/upstreem-mark-square-1f1f1f.svg";
  /* Die Wortmarke als EINE Datei: Zeichen und Wort in den offiziellen Abstaenden. Vorher stand in
     Kopf und Fuss das quadratische Zeichen und daneben das Wort als Text -- zwei Dinge, deren
     Verhaeltnis zueinander von der Schriftgroesse abhing und mit der offiziellen Marke nur
     ungefaehr uebereinstimmte. Gemessen am geladenen Bild: 761x108, also 7.046:1 -- daraus die
     Breiten in den Attributen (141 zu 20 im Kopf, 218 zu 31 im Fuss). Sie halten nur den Platz
     bis zum Laden; die Groesse setzt die CSS. */
  var WORTMARKE = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/" +
    "BRANDSTYLES/upstreem-lockup-1f1f1f.svg";
  /* Radien der drei Bahnen. Der Kasten der Vorschau ist 330px hoch, SICHTBAR sind davon 304 -- die
     oberen 26 sind die Polsterung, unter der der Inhalt durchlaeuft (siehe .ulh-vis). Die aeussere
     Bahn hat mit 138 also 276 Durchmesser und steht in den 304 mit 14px Luft nach oben und unten.
     Mit 150 stand sie unten an der Kante an und wurde angeschnitten -- so gemeldet. */
  var ORBIT_R = [66, 102, 138];

  var MERKMAL_CHIP = "Platform";
  var MERKMAL_H = "From AI answers to your next move";
  var MERKMAL_SUB = "Visibility, prompts, sources and tasks in one place, across every major model, " +
    "every day.";

  /* ---- Die Vorschauen in den Karten ----
     Jede Karte zeigt das Bauteil, von dem sie spricht -- und zwar das ECHTE: die Zeilen sind
     .up-row mit --up-cols und den Zellen der App, die Domaintabelle samt aufgeklapptem Drilldown
     ist die aus domains-table, und die Chancen sind .uo-row im Listenmodus. Nachgezeichnete
     Bildchen waeren an dem Tag falsch, an dem sich eines dieser Bauteile aendert; diese hier
     aendern sich mit.
     Alle stehen in einem Kasten, der ihre VOLLE Groesse hat und danach verkleinert wird
     (--ulh-vs, dieselbe Machart wie in den Nebenfenstern oben): so behalten sie die Geometrie der
     App und passen trotzdem in eine Karte. */

  /* ---- Karte 1: zwei Kurven ----
     Kein Achsenkreuz, keine Legende, keine Ueberschrift -- nur die zwei Linien und an jeder ein
     Schild mit Marke und Wert. Deshalb NICHT UC.makeLine: dessen ganze Arbeit sind Achsen, Legende
     und der gemeinsame Tooltip, und drei davon abzuschalten waere mehr Eingriff als ein eigener,
     kleiner Aufruf von Chart.js -- der Werkzeugkasten, auf dem makeLine selbst sitzt.
     Was aus der App kommt: die Markenfarben, die Linienstaerke (1.80625, der dicke Wert aus core),
     die Rundung der Kurve und die Form der Schilder (Werte aus dem Tooltip in core.js: Radius 16,
     13px, 10/12 Polster, 16px Logo).
     Die ZAHLEN erzaehlen die Geschichte der Sektion: eine Marke, die seit Monat drei zulegt, und
     eine, die stehenbleibt. Acme geht von 18.2 auf 38.9 (dieselbe 38.9 wie im Fenster oben),
     BMW von 26.1 auf 23.9. */
  /* hoch: ein zusaetzlicher Versatz nach oben. Die Lage des Schildes wird aus dem Wert der Kurve
     an seiner Stelle gerechnet, und zwar LINEAR zwischen zwei Punkten -- die gezeichnete Kurve ist
     aber gerundet (tension 0.38) und woelbt sich auf einem steigenden Stueck nach oben. Beim
     Schild der eigenen Marke, das auf dem steilsten Stueck sitzt, sind das rund 16px: der Strich
     endete darunter im Leeren. Ein fester Versatz statt einer Bezier-Rechnung, weil genau eine
     Stelle betroffen ist. */
  /* farbe: eine EIGENE Linienfarbe nur fuer diese Karte. BMW traegt in MARKEN den zweiten Schritt
     der Linear-Skala (#00aad3), direkt neben Acmes erstem (#579cf1). Hier stehen nur diese zwei
     Linien, und zwei benachbarte Blautoene lasen sich als eine Farbe (28.09. gemeldet: "mach die
     BMW Line Color anders, ist zu nah an ACME"). Gerechnet in OKLab: 32 Grad Farbton auseinander,
     Delta E 0.076.
     Genommen ist der SIEBTE Schritt derselben Skala (#d88225, COLOR_SCALES.linear in core.js) und
     nichts Erfundenes: das andere Ende von Blau nach Orange, 193 Grad weg, Delta E 0.288 -- bei
     GLEICHER Helligkeit und Buntheit (L 0.684 gegen 0.686, C 0.145 gegen 0.144), also draengt sich
     keine der zwei Linien vor. Die sechs Linien im Fenster oben nehmen die ersten sechs Schritte,
     diese Farbe steht dort nirgends.
     MARKEN bleibt unberuehrt: von dort holt sich auch das Chart im Fenster oben seine
     Markenfarben. */
  var KRV = [
    { id: "bm", farbe: "#d88225", schild: 1, hoch: 0,  werte: [26.1, 25.4, 24.8, 25.1, 24.2, 23.9] },
    { id: "ac", schild: 5, hoch: 16, werte: [18.2, 19.1, 22.6, 28.4, 34.2, 38.9] }
  ];
  var KRV_MIN = 12, KRV_MAX = 47;      /* Rand oben fuer das Schild, unten fuer die flache Kurve */
  /* Der Abstand zwischen Punkt und Schild -- der graue Strich dazwischen ist genau so lang. */
  var KRV_ABSTAND = 15;

  function krvSchild(m, wert){
    return '<span class="ulh-krv-chip" data-krv="' + m.id + '">' +
      '<img class="ulh-krv-logo" src="' + m.logo + '" alt=""/>' +
      '<span class="ulh-krv-name">' + m.name + '</span>' +
      '<span class="ulh-krv-val">' + eine(wert) + '%</span>' +
    '</span>';
  }

  function visLinie(){
    return '<div class="ulh-krv">' +
      '<canvas class="ulh-krv-canvas"></canvas>' +
      KRV.map(function(k){
        var m = MARKEN.filter(function(x){ return x.id === k.id; })[0];
        return m ? krvSchild(m, k.werte[k.schild]) : "";
      }).join("") +
    '</div>';
  }

  /* ---- Karte 2: drei Zeilen der Prompt-Tabelle ----
     Kurze Fragen mit Absicht: die Spalte darf nicht die halbe Tabelle einnehmen, und in einer
     Vorschau liest man den Anfang. Ein bis zwei Themen je Zeile, aus derselben Themenliste wie
     die Prompts-Seite oben. */
  /* FUENF Zeilen, und die letzte wird vom Auslauf angeschnitten: eine Vorschau, die genau
     aufgeht, sagt "das ist alles" -- eine, die unten weich ausgeht, sagt "hier geht es weiter".
     Gemessen: 5 mal 72 plus 40 Kopfzeile sind 400px Inhalt in einem 370px hohen Ausschnitt. */
  /* marken: die Marken in den Antworten auf diesen Prompt, als Kennungen aus MARKEN -- dieselben
     Zeichen wie im Dashboard und in der Prompts-Seite oben. Angefuehrt von der eigenen Marke,
     sobald sie vorkommt (dieselbe Regel wie promptMarken). nennungen ist die GESAMTzahl, aus der
     der Stapel sein "+N" rechnet: er zeigt hoechstens vier Zeichen, wie in der App.
     Die zwei Zeilen ohne Visibility sind Prompts OHNE Daten (noch keine Antwort), und die haben
     in der App auch keine Marken: dort steht das Minuszeichen des leeren Stapels. Ein Stapel neben
     "–" in allen anderen Spalten waere ein Widerspruch in derselben Zeile. */
  var VIS_ZEILEN = [
    { prompt: "Best premium electric SUV",     vis: 38.9, marken: ["ac", "bm", "au", "te"], nennungen: 6, themen: [2, 1], markt: "US" },
    /* Der Leerzustand steht in der dritten Zeile -- auch in einer Vorschau gehoert dazu, dass man
       nicht ueberall genannt wird. */
    { prompt: "Premium SUV leasing rates",     vis: 21.4, marken: ["ac", "bm", "au", "vo"], nennungen: 5, themen: [0],    markt: "US" },
    { prompt: "Alternativen zum BMW iX",       vis: null, marken: [],                       nennungen: 0, themen: [1, 2], markt: "DE" },
    { prompt: "Longest range electric estate", vis: 18.2, marken: ["ac", "te", "vo"],       nennungen: 3, themen: [2],    markt: "UK" },
    { prompt: "Which EV charges fastest",      vis: null, marken: [],                       nennungen: 0, themen: [3, 2], markt: "US" },
    /* Zwei Zeilen mehr (07.10.): die Karte ist hoeher geworden, und eine Tabelle, die nach fuenf
       Zeilen in Weiss endet, sieht leer aus statt angeschnitten. */
    { prompt: "Most reliable luxury EV brand", vis: 27.6, marken: ["bm", "ac", "au"],       nennungen: 4, themen: [0],    markt: "US" },
    { prompt: "Bestes Elektro-SUV für Familien", vis: 12.3, marken: ["vo", "ac"],           nennungen: 2, themen: [1],    markt: "DE" }
  ];
  /* Die Zahl neben "Prompts" im Kopf der Vorschau -- ein Konto mit einer gut gefuellten Liste. */
  var VIS_ZEILEN_ZAHL = 248;
  /* Der Export-Knopf WORTGLEICH aus der Vorlage der Prompts-Tabelle (dieselbe Zeichnung, die im
     Hero-Fenster oben steht). core baut ihn nicht -- er steht in jeder Bubble-Vorlage als Markup --,
     also steht er hier einmal als Konstante und nicht als nachgezeichnetes Zeichen. */
  var EXPORT_KNOPF = '<button class="up-export" type="button" tabindex="-1" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />' +
    '<path d="m7 10 5 5 5-5" /></svg><span>Export</span></button>';

  function visZeilen(){
    var kern = window.UpstreemCore;
    /* Die Reihenfolge der Spalten ist die der App: Prompt, Visibility, Brand Mentions, Topics,
       Market. Visibility fehlte in der ersten Fassung ganz -- und sie ist die Zahl, um die es in
       dieser Karte geht. Die Spalte "Mentioned" faellt dafuer weg: eine leere Visibility sagt
       dasselbe.
       RANK UND SENTIMENT SIND RAUS, DIE MARKEN STEHEN DAFUER DA (28.09. angefordert: "Zeige in
       der Prompts Table statt Rank und Sentiment bitte die Mentioned Brands"). Die Karte sagt
       "see where you are named and where you are not" -- das zeigt ein Stapel aus Markenzeichen
       auf einen Blick, zwei Zahlen daneben nicht.
       Die Beschriftung ist die der App: "Brand Mentions" (prompts-table.js, COLS) und nicht die
       Worte aus der Anfrage -- hier steht die echte Tabelle, und die heisst dort so. */
    var kopf = ["Prompt", "Visibility", "Brand Mentions", "Topics", "Market"];
    /* Die Spalten stehen als --up-cols am Kasten: .up-row ist ein Raster und liest sie von dort.
       Ohne diese Angabe erbt die Zeile die Spalten der zuletzt definierten Tabelle. */
    /* Topics 260: zwei Chips brauchen zusammen bis zu 215px, dazu 28 Polster der Zelle. Bei 200
       waren die Beschriftungen um 7 bis 32px abgeschnitten (gemessen). */
    /* Die Prompt-Spalte bekommt mehr Platz: sie ist die einzige, die man wirklich LIEST, und die
       anderen fuenf zeigen Zahlen und Zeichen. Genommen wird es von den vier festen Spalten und
       von den Themen (260 -> 210, ein Chip ganz und der zweite angeschnitten -- in einer Vorschau
       ist das genug). Gerechnet: die festen Spalten waren zusammen 648, jetzt 570; auf einer
       838px breiten Vorschau waechst die Prompt-Spalte damit von 190 auf 268. */
    /* Die Prompt-Spalte 20px breiter (21.09. angefordert). Sie ist 1fr, nimmt also den Rest --
       breiter wird sie nur, wenn eine andere Spalte abgibt. Das tut die Themenspalte: 210 -> 190.
       Dort stehen hoechstens zwei Chips, und die sind zusammen keine 190px breit. */
    /* Brand Mentions 180 = Rank 84 + Sentiment 96: die Summe der festen Spalten bleibt 550, die
       Prompt-Spalte behaelt also genau ihre Breite (auch die 830px der schmalen Fassung in
       landing-hero.css rechnen mit dieser Summe). Gebraucht werden 100px fuer vier Zeichen
       (28 + 3 x 24, sie ueberlappen um 4), 22 fuer das "+N" und 28 Zellpolster -- der Rest ist
       der Weg, den die Zeichen beim Ueberfahren zur Seite gehen (16px). */
    /* THEMEN 125 (29.09. spaet, "die Topics sind truncated, mach das nicht"): die Chips werden
       nicht mehr gestaucht, sondern brechen um (landing-hero.css, .ulh-vis-themen) -- die Spalte
       muss also nur den breitesten EINZELNEN Chip fassen: "Comparisons" 96.6 plus 28 Polster.
       Zwei nebeneinander braeuchten 195, und bei 190 wurden sie gestaucht und abgeschnitten.
       Die frei werdenden 65px gehen an die Prompt-Spalte (1fr): bei 1280 sah man vorher 106px
       von jedem Prompt, keiner passte. */
    /* SPALTEN MIT MEHR LUFT RECHTS (07.10. angefordert): die Tabelle ist kleiner skaliert und hat
       kaum noch seitliches Polster, steht also auf mehr ungeskalierten Pixeln -- die gehen an die
       festen Spalten, damit Zahl, Zeichen und Chips nicht an ihrer rechten Kante kleben:
       Visibility 96 -> 120, Brand Mentions 180 -> 196, Topics 125 -> 150, Market 84 -> 104. */
    var kastchen = function(){
      return '<span class="upt-check" aria-hidden="true">' + ((kern && kern.CHECK_SVG) || "") + '</span>';
    };
    /* DER KOPF DER APP (07.10. angefordert: "Heading + Count + Toolbar Ausklapp Icon + Export
       button, wie in der Hauptapp"). Dieselben Klassen wie im Kopf der Prompts-Tabelle, alle aus
       core: .up-head, .up-heading mit Zahl (has-count), .up-tbtrig (der Knopf, der die
       eingeklappte Werkzeugleiste aufzieht -- dasselbe Zeichen, das UC.makeToolGroup setzt) und
       .up-export. Nichts davon ist hier bedienbar, also tabindex -1 und aria-hidden. */
    var html = '<div class="up-head ulh-vis-kopf">' +
        '<div class="up-heading has-count"><span class="up-head-label">Prompts</span>' +
          '<span class="up-head-sep"></span><span class="up-head-count">' + VIS_ZEILEN_ZAHL + '</span></div>' +
        '<div class="up-head-tools">' +
          '<button class="up-iconbtn up-tbtrig" type="button" tabindex="-1" aria-hidden="true">' +
            ((kern && kern.icon) ? kern.icon("listFilterPlus", 2) : "") + '</button>' +
          EXPORT_KNOPF +
        '</div>' +
      '</div>' +
      '<div class="ulh-vis-tab" style="--up-cols: minmax(0,1fr) 120px 196px 150px 104px;">' +
      /* Die Spaltenkoepfe sind .up-th wie in der App (12px, 400, --vc-muted aus core) und nicht
         mehr .up-td mit eigener Groesse und eigenem Schnitt. Das Kaestchen vor "Prompt" ist das
         "alle waehlen" der App. */
      '<div class="up-row up-thead">' + kopf.map(function(t, k){
        return '<div class="up-th' + (k === 0 ? " up-th-prompt" : "") + '">' + (k === 0 ? kastchen() : "") +
          '<span class="up-th-txt">' + t + '</span></div>'; }).join("") + '</div>';
    html += VIS_ZEILEN.map(function(z, i){
      var leer = '<span class="up-num is-empty">–</span>';
      /* Ohne Nachkommastelle (29.09. spaet angefordert, hier und in der Domain-Karte): in einer
         Vorschau liest man die Groessenordnung, nicht die Zehntel. proz ist UC.fmtPct. */
      var sicht = z.vis == null ? leer
        : '<span class="up-num">' + proz(z.vis) + '</span>';
      /* Der Stapel ist UC.brandStack aus core -- derselbe Aufruf wie in der Zelle der
         Prompts-Tabelle (prompts-table.js), mit denselben Klassen und derselben CSS. Die Zeichen
         sind die aus MARKEN (Acme als eigenes Zeichen, die Hersteller ueber den Favicon-Dienst),
         also dieselben Bilder wie ueberall sonst auf der Seite.
         OHNE data-brandtip: daran haengt der Tooltip von core, und im Schaustueck zeigt nichts
         einen Hinweis (dieselbe Regel wie ohneTipps). */
      var nennungen = (z.marken || []).map(function(id){
        var m = MARKEN.filter(function(x){ return x.id === id; })[0];
        return m ? { name: m.name, favicon: m.logo } : null;
      }).filter(Boolean);
      var marken = kern && kern.brandStack
        ? kern.brandStack(nennungen, z.nennungen).replace(/ data-brandtip="[^"]*"/g, "")
        : leer;
      /* Die Themenchips sind .up-topicchip aus core -- dieselben wie in der Prompts-Tabelle oben,
         gefaerbt aus derselben Themenliste. */
      /* EIN Thema je Zeile (06.10. angefordert) -- das erste, das fuer die Zeile steht. */
      var themen = z.themen.slice(0, 1).map(function(ti){
        var t = THEMEN[ti % THEMEN.length];
        return '<span class="up-topicchip" style="--ust-tag-color:' + (t.hex_light || "#6b7280") + ';">' +
          (t.emoji ? '<span class="up-topicchip-e">' + t.emoji + '</span>' : "") +
          '<span class="up-topicchip-lbl">' + t.name + '</span></span>';
      }).join("");
      /* KEINE gehobene Zeile mehr (07.10. angefordert: "die Hoveranimation auf der Prompt-Tabelle
         komplett weg"): ohne is-mitte greift keine der Regeln dafuer in landing-hero.css. Die
         Produkttabelle im Handel-Block behaelt ihre -- sie baut ihre Zeilen selbst.
         Das Kaestchen vorne wie in der App (.upt-td-prompt traegt den Abstand zum Text). */
      return '<div class="up-row">' +
        '<div class="up-td upt-td-prompt">' + kastchen() + '<span class="ulh-vis-prompt">' + z.prompt + '</span></div>' +
        '<div class="up-td">' + sicht + '</div>' +
        '<div class="up-td">' + marken + '</div>' +
        '<div class="up-td"><span class="ulh-vis-themen">' + themen + '</span></div>' +
        '<div class="up-td">' + (kern ? kern.marketChip(z.markt) : z.markt) + '</div>' +
      '</div>';
    }).join("");
    return html + '</div>';
  }

  /* ---- Karte 3: die Domaintabelle mit aufgeklapptem Drilldown ----
     Drei Domainzeilen, die dritte offen: darunter die Seiten dieser Domain, wie in der App
     (domains-table.js, subrowHtml). Reddit als offene Zeile, weil ihre Pfade auf einen Blick
     sagen, was eine Seite ist -- r/SaaS, ein Threadtitel, ein Kommentar.
     Die Klassen sind die der Komponente; ihre CSS liegt im Lader (domains-table.css). Statisch
     und ohne ihr JS: hier klappt niemand etwas auf, es ist schon offen. */
  var VIS_DOM = [
    { dom: "forbes.com",    share: 18.4, delta: 2.1,  seiten: 42, typ: "Editorial",      gesehen: "Aug 26, 2026" },
    { dom: "wikipedia.org", share: 11.7, delta: 0.8,  seiten: 18, typ: "Knowledge_Base", gesehen: "Aug 25, 2026" },
    { dom: "reddit.com",    share: 14.1, delta: -1.3, seiten: 63, typ: "UGC_Community",  gesehen: "Aug 27, 2026", offen: true }
  ];
  /* Volle URLs und nicht nur Pfade: aus ihnen baut core den Titel, den die App auch zeigt --
     UC.redditTitleHtml macht daraus "r/SaaS" in der dritten Textfarbe, einen Trennstrich und den
     Rest. Der Titel selbst ist "reddit.com", also das, was ein Scraper dort tatsaechlich findet
     -- genau der Fall, fuer den es diese Funktion gibt. */
  var VIS_DOM_URLS = [
    { url: "https://www.reddit.com/r/electricvehicles/comments/1a2b3c/best_premium_electric_suv/", anteil: 24.6, typ: "forum", gesehen: "Aug 27, 2026" },
    { url: "https://www.reddit.com/r/cars/comments/2b3c4d/real_winter_range_thread/", anteil: 18.2, typ: "forum", gesehen: "Aug 26, 2026" },
    { url: "https://www.reddit.com/r/electricvehicles/comments/3c4d5e/charging_speed_compared_2026/", anteil: 12.9, typ: "forum", gesehen: "Aug 24, 2026" },
    { url: "https://www.reddit.com/r/whatcarshouldIbuy/comments/4d5e6f/estate_or_suv/", anteil: 9.4, typ: "forum", gesehen: "Aug 22, 2026" },
    { url: "https://www.reddit.com/r/cars/comments/5e6f7g/leasing_vs_buying_in_2026/", anteil: 7.1, typ: "forum", gesehen: "Aug 21, 2026" }
  ];

  function visDomains(){
    var kern = window.UpstreemCore;
    function tag(typ, modus){
      if (!kern || !kern.typeColor) return "";
      var farbe = kern.typeColor(typ, modus, false);
      var name = modus === "url" ? (kern.URL_LABEL[typ] || typ) : kern.citeName(typ);
      /* Dieselbe Pille wie in der Zitattabelle: Grund in der Typfarbe mit wenig Deckkraft, die
         Werte aus core (typeColor) und nicht von hier.
         DER PUNKT NUR BEI DEN URL-TYPEN (21.09. gemeldet: "die Citation Types ohne den Punkt
         davor, die Punkte nur bei den URL Types, wie in der Hauptapp"). Genau so macht es die
         Komponente auch -- tagInfo() in topcitations-dashboard.js gibt dot: true nur im Modus
         "url" zurueck. Hier stand der Punkt an beiden, und damit sah das Schaustueck anders aus
         als die App. */
      var punkt = modus === "url"
        ? '<span class="tct-tag-dot" style="background:' + farbe + '"></span>' : "";
      return '<span class="tct-tag" style="background:' + farbe + '1f;color:' + farbe + '">' +
        punkt + '<span class="tct-tag-lbl">' + name + '</span></span>';
    }
    /* Type 172 statt 116, und das ist gerechnet: die laengste Pille ("UGC / Community") misst
       innen 103px, dazu 20 Polster der Pille, 6 Punkt, 6 Abstand und 28 Polster der Zelle -- macht
       163. Bei 152 fehlten 11px und die Beschriftung wurde abgeschnitten (gemessen: 90 sichtbar
       von 98 noetigen). Die Domainspalte gibt den Platz her, sie hat mit Namen und Seitenknopf
       immer noch 600px. */
    /* Die Domainspalte gibt 60px ab, gleichmaessig auf die drei anderen verteilt: sie hat mit
       Namen und Seitenknopf immer noch Platz, und Share, Type und Last Seen standen enger als
       noetig. Type ist dabei so breit, dass die laengste Pille ("UGC / Community", 163px mit
       allem) ganz hineinpasst. */
    var cols = "--up-cols: minmax(0,1fr) 138px 192px 136px;";
    var html = '<div class="ulh-vis-dom" style="' + cols + '">' +
      '<div class="up-row up-thead"><div class="up-td">Domain</div>' +
      '<div class="up-td">Share</div><div class="up-td">Type</div>' +
      '<div class="up-td">Last Seen</div></div>';
    VIS_DOM.forEach(function(d, i){
      html += '<div class="up-row' + (d.offen ? " is-expanded" : "") + '">' +
        '<div class="up-td up-td-domain">' +
          '<span class="udt-logo-box has-img"><span class="udt-logo-ltr">' + d.dom.charAt(0).toUpperCase() + '</span>' +
            '<img src="' + quellzeichen(d.dom) + '" alt=""/></span>' +
          '<span class="udt-dom-wrap"><span class="udt-dom-title">' + d.dom + '</span>' +
            /* KEIN CHEVRON MEHR (24.09. gemeldet: "direkt nach den x pages ist ein komisches
               Element sichtbar, was ist das? mach das weg").
               Was man sah, war ein ANGESCHNITTENER Strich: in der App traegt das SVG SELBST die
               Klasse udt-chev, und deren 13x13 wirken damit auf das Zeichen. Hier stand die
               Klasse an einem span und das Zeichen kam mit seinen eigenen 24px hinein --
               13px Kasten, overflow: hidden, 24px Inhalt. Uebrig blieb ein Strichstueck.
               Weg statt repariert, weil hier ohnehin niemand etwas aufklappt: die Zeile ist
               schon offen, der Knopf traegt pointer-events: none. */
            '<button class="up-pages udt-pagesbtn' + (d.offen ? " is-open" : "") + '" type="button" tabindex="-1">' +
              '<span class="udt-pagesbtn-lbl">' + d.seiten + ' pages</span>' +
            '</button>' +
          '</span>' +
        '</div>' +
        '<div class="up-td up-td-share"><span class="udt-num">' + proz(d.share) + '</span>' +
          (kern && kern.trendChip ? kern.trendChip(d.delta, { suffix: "%" }) : "") + '</div>' +
        '<div class="up-td up-td-type">' + tag(d.typ, "domain") + '</div>' +
        '<div class="up-td up-td-lastseen"><span class="udt-date">' + d.gesehen + '</span></div>' +
      '</div>';
      if (!d.offen) return;
      /* FUENF Spalten wie in der App: Seite, Anteil an der Domain, Typ, zuletzt gesehen und der
         Pfeil. Das Raster dafuer bringt domains-table.css mit (--udt-subcols); mit drei Spalten
         standen Kopf und Zeilen in einem Raster fuer fuenf, und zwei Spalten blieben leer. */
      /* Der Aufbau ist der der App, Element fuer Element: Werkzeugleiste, Kopfzeile, LISTE, Zeilen.
         Die Liste als eigener Kasten ist kein Beiwerk -- ohne sie ist die erste Zeile nicht mehr
         :first-child, ihr Rahmen oben bleibt stehen, und unter der Kopfzeile stehen zwei Linien.
         Genau das war zu sehen.
         Die Werkzeugleiste ist statisch: Suchfeld, Typfilter, Titel/URL-Umschalter, Schliessen --
         dieselben Klassen wie in domains-table.js, nur ohne die Menues dahinter. */
      html += '<div class="udt-subrows"><div class="udt-sub-inner">' +
        '<div class="udt-sub-toolbar">' +
          '<div class="udt-sub-tools">' +
            '<div class="udt-sub-search">' +
              '<span class="udt-sub-search-ic" data-ic="search" data-ic-w="2"></span>' +
              '<input class="udt-sub-search-in" type="text" placeholder="Search pages…" readonly tabindex="-1"/>' +
            '</div>' +
            '<div class="udt-sub-filter">' +
              '<button class="up-filter-btn udt-sub-filterbtn" type="button" tabindex="-1">' +
                '<span class="up-filter-btn-lbl">All URL Types</span>' +
                '<svg class="up-filter-btn-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="udt-sub-dispseg" role="group">' +
              '<button class="udt-sub-disp-btn is-active" type="button" tabindex="-1">Title</button>' +
              '<button class="udt-sub-disp-btn" type="button" tabindex="-1">URL</button>' +
            '</div>' +
          '</div>' +
          /* .up-iconbtn wie in der App -- ohne die Klasse ist der Knopf ein grauer Kasten ohne
             Groesse (gemessen 12x4px). Das Zeichen kommt DIREKT in den Knopf und nicht in einen
             span darin: die CSS des Knopfes richtet sein svg, und mit einem span dazwischen
             bekommt es keine Groesse. */
          '<button class="up-iconbtn udt-sub-closebtn" type="button" tabindex="-1" aria-label="Close" ' +
            'data-ic="x" data-ic-w="2.2"></button>' +
        '</div>' +
        '<div class="udt-sub-head"><span>Page</span><span class="udt-sub-h-num">Domain Share</span>' +
        '<span>Type</span><span>Last Seen</span><span></span></div>' +
        '<div class="udt-sub-list">' +
        VIS_DOM_URLS.map(function(u){
          var titel = (kern && kern.redditTitleHtml ? kern.redditTitleHtml(u.url, d.dom) : null) || u.url;
          return '<div class="udt-subrow">' +
            '<span class="udt-sub-main">' +
              '<span class="udt-sub-logo has-img"><span class="udt-sub-ltr">R</span>' +
                '<img src="' + quellzeichen(d.dom) + '" alt=""/></span>' +
              '<span class="udt-sub-title">' + titel + '</span>' +
            '</span>' +
            '<span class="udt-sub-share">' + proz(u.anteil) + '</span>' +
            '<span class="udt-sub-type">' + tag(u.typ, "url") + '</span>' +
            '<span class="udt-sub-date">' + u.gesehen + '</span>' +
            '<span class="udt-sub-goto">' + (kern && kern.GOTO_SVG ? kern.GOTO_SVG : "") + '</span>' +
          '</div>';
        }).join("") +
        '</div>' +
      '</div></div>';
    });
    return html + '</div>';
  }

  /* ---- Karte 4: drei Chancen im Listenmodus ----
     .uo-row wie in der App, wenn das Brett auf Liste steht. Die mittlere traegt is-mitte: beim
     Ueberfahren der Karte kommt sie nach vorn und die zwei anderen treten zurueck. */
  var VIS_CHANCEN = [
    { h: "Get the estate into the forbes.com buyer guide", dom: "forbes.com", pot: 4, themen: [2] },
    { h: "No page of yours answers the winter range question", dom: "reddit.com", pot: 3, themen: [2] },
    { h: "Your charging page is cited, never quoted", dom: "acme.com", pot: 2, themen: [3] },
    { h: "Show up in the comparison videos", dom: "youtube.com", pot: 3, themen: [1] },
    { h: "Add the model year to the wikipedia entry", dom: "wikipedia.org", pot: 2, themen: [5] },
    { h: "Answer the leasing thread on motor-talk", dom: "motor-talk.de", pot: 3, themen: [0] }
  ];

  function visChancen(){
    var kern = window.UpstreemCore;
    return '<div class="ulh-vis-chancen"><div class="uo-list-rows">' +
      VIS_CHANCEN.map(function(c, i){
        var logo = c.dom.indexOf("acme.com") >= 0 ? MARKEN[0].logo : quellzeichen(c.dom);
        var bars = "";
        for (var b = 1; b <= 4; b++) bars += '<span class="uo-pot-bar p' + b + (b <= c.pot ? " is-on" : "") + '"></span>';
        var themen = c.themen.map(function(ti){
          var t = THEMEN[ti % THEMEN.length];
          return '<span class="up-topicchip" style="--ust-tag-color:' + (t.hex_light || "#6b7280") + ';">' +
            (t.emoji ? '<span class="up-topicchip-e">' + t.emoji + '</span>' : "") +
            '<span class="up-topicchip-lbl">' + t.name + '</span></span>';
        }).join("");
        return '<div class="uo-row' + (i === 1 ? " is-mitte" : "") + '">' +
          '<div class="uo-row-main">' +
            '<span class="uo-row-title">' + c.h + '</span>' +
            '<span class="uo-row-sub"><span class="up-logo-box has-img"><img src="' + logo + '" alt=""/>' +
              '<span class="up-logo-ltr">' + c.dom.charAt(0).toUpperCase() + '</span></span>' +
              '<span class="uo-row-domain">' + c.dom + '</span></span>' +
          '</div>' +
          '<div class="uo-row-right"><span class="uo-row-tags">' + themen + '</span>' +
            '<div class="uo-pot"><div class="uo-pot-bars">' + bars + '</div></div></div>' +
        '</div>';
      }).join("") +
    '</div></div>';
  }

  function visInhalt(art){
    if (art === "linie")   return visLinie();
    if (art === "zeilen")  return visZeilen();
    if (art === "domains") return visDomains();
    if (art === "chancen") return visChancen();
    if (art === "sprachen") return visSprachen();
    if (art === "modelle")  return visModelle();
    if (art === "produkte") return visProdukte();
    if (art === "bewegung") return visBewegung();
    if (art === "regal" || art === "werber") return '<div class="ulh-balken" data-ulh-balken="' + art + '"></div>';
    if (art === "anzeigen") return visAnzeigen();
    if (art === "eventkarte") return visEventKarte();
    if (art === "eventkurve") return '<div class="ulh-evk" data-ulh-evk><div class="ulh-evk-wrap"><canvas class="up-line-canvas"></canvas></div><div class="up-legend"></div></div>';
    return "";
  }

  /* ---- Vorschau: das Endlosband der Prompts ----
     Die Huelle ist statisch, die Zeilen kommen beim Fuellen -- sie brauchen UC.marketChip fuer
     Flagge und Kuerzel (core.css: .up-market/.up-flag/.up-market-code), und die Liste wird dort
     ausserdem VERDOPPELT: nur mit zwei gleichen Haelften kann das Band ohne Sprung umlaufen.
     Der Kasten traegt oben UND unten eine Blende -- ein Band, das an einer harten Kante endet,
     sieht aus wie eine abgeschnittene Liste und nicht wie ein Lauf. */
  function visSprachen(){
    return '<div class="ulh-lauf" data-ulh-lauf>' +
             '<div class="ulh-lauf-spur" data-ulh-spur></div>' +
           '</div>';
  }
  /* ---- Vorschau: die Modelle auf ihren Bahnen ----
     Drei Kreise, darauf die Zeichen der Modelle, in der Mitte die Marke. Die Bahnen drehen, die
     Zeichen NICHT -- jedes dreht seinen Kreis wieder heraus (siehe orbTakt), sonst stehen die
     Logos auf dem Kopf. Aufgebaut wird auch das beim Fuellen: die Lage jedes Zeichens ist
     gerechnet (Winkel), und gerechnete Werte gehoeren nicht in eine Zeichenkette. */
  function visModelle(){
    return '<div class="ulh-orb" data-ulh-orb>' +
             '<div class="ulh-orb-mitte"><img alt="" referrerpolicy="no-referrer" src="' +
               ORBIT_MARKE + '"/></div>' +
           '</div>';
  }

  /* ---------- Shopping und Ads: "Beyond classic GEO" (06.10. angefordert) ---------------------
     Ein zweiter Kartenblock unter dem ersten, 2x2, "genauso konsistent wie die Cards darueber":
     dieselbe Karte (merkmalKarte), derselbe Kasten, dieselben Anteile (60/40 oben, 40/60 unten),
     und in jeder Vorschau ein ECHTES Bauteil der App -- die Zeilen der Tabelle (.up-row mit
     UC.markenChip), die Balkenliste (UC.makeBarList, dieselbe wie in Shopping und Ads) und die
     Ad-Karte (UC.adCardHtml). Die Zahlen sind Demodaten im Automobilmarkt der Seite: plausibel,
     nicht schmeichelhaft, die eigene Marke ist die erfundene Acme. */
  var HANDEL_CHIP = "Shopping & Ads";
  var HANDEL_H = "Beyond classic GEO";
  /* Die Ueberschrift hat der Nutzer selbst vorgegeben ("Beyond Classic GEO"); neu ist nur die
     Unterzeile -- "dieselben Prompts" sagt, dass es EIN Werkzeug ist und kein zweites. */
  var HANDEL_SUB = "Shopping results and sponsored placements, tracked on the same prompts as your " +
    "visibility.";
  var HANDEL = [
    { breit: 60, vis: "produkte", stil: "zeilen",
      h: "See which products AI puts first",
      p: "Position, rating and price for every product the models recommend, yours and your competitors'." },
    /* Oben rechts seit dem 06.10. die Produktbewegung von Shopping statt der Balken (angefordert).
       06.10. nachts: "eher, dass man Dynamiken frueh erkennen und steuern kann" -- also beides in
       der Zeile: frueh SEHEN (Schwung) und STEUERN (womit). */
    { breit: 40, vis: "bewegung",
      h: "Spot product momentum early",
      p: "See which products gain or lose AI recommendations, and steer content, pricing or ads while the shift is small." },
    { breit: 40, vis: "werber",
      h: "Find out who buys your prompts",
      p: "Every advertiser showing ads on your tracked prompts, ranked by share of placements." },
    /* 06.10. nachts: "strategischer" -- die Karte zeigt nicht Anzeigen, sie zeigt, wie die
       Wettbewerber im Kaufmoment spielen: was sie versprechen, welche Fragen sie kaufen, wohin der
       Klick geht. Und wozu man das wissen will: um zu antworten. */
    { breit: 60, vis: "anzeigen",
      h: "Read the strategy behind every ad",
      p: "What rivals promise, which buyer questions they target and where each click lands, so you can plan your answer." }
  ];
  /* ---- ECHTE PRODUKTE MIT ECHTEN FOTOS (06.10. angefordert: "echte Produkte und echte
     Produktbilder -- guter Mix aus Autozubehoer, Wallboxen, ganzen Autos, Leasingangeboten") ----
     Die Fotos kommen von Wikimedia Commons (upload.wikimedia.org): freie Lizenzen, feste Adressen,
     dort ist das Einbinden ausdruecklich erlaubt. Jede Adresse am 06.10. geprueft (HTTP 200,
     image/jpeg, 330px-Vorschau -- Commons liefert nur noch Standardbreiten: 250/330/500/960).
     DIE LIZENZEN VERLANGEN EINEN NACHWEIS: nur zwei Fotos sind CC0, die anderen CC BY oder CC BY-SA.
     Er steht seit dem 06.10. nachts im Fuss ("Image credits", bildnachweisHtml) und als title am
     Foto -- wer ein Foto tauscht, traegt autor, lizenz und seite mit (eine neue Lizenz auch in
     LIZENZ_URL).
     Die Marken: getrackte Hersteller (Tesla, BMW, Audi, Volvo, Porsche) und die erfundene Acme --
     ihre Produkte zeigen allgemeine Fotos (eine Wallbox, Fussmatten, ein Ladekabel) ohne fremde
     Marke darauf. Thule ist nicht getrackt und steht deshalb, wie in der App, als "Other".
     vis/pos sind [jetzt, vorher]; Preise in Euro, Leasing als Monatsrate im Titel. */
  var WIKI = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
  function wikiBild(pfad, breite){
    return WIKI + pfad + "/" + (breite || 330) + "px-" + pfad.slice(pfad.lastIndexOf("/") + 1);
  }
  var ECHTE_PRODUKTE = [
    { id: "p1", t: "Tesla Model Y Premium Long Range AWD", m: "te", preis: [49990, 49990],
      bild: "e/e7/Tesla_Model_Y_Premium_%28Facelift%29_%E2%80%93_f_05052026.jpg",
      vis: [31.4, 27.0], pos: [1.6, 1.9], note: 4.6, stimmen: 1840, haendler: 3,
      autor: "M 93", lizenz: "CC BY-SA 3.0 de", seite: "Tesla_Model_Y_Premium_(Facelift)_%E2%80%93_f_05052026.jpg" },
    { id: "p2", t: "Acme Home Charger 11 kW", m: "ac", preis: [799, 899],
      bild: "a/af/Delta_Electronics_EVPT3215MWE_20190601.jpg",
      vis: [28.9, 19.2], pos: [1.4, 2.1], note: 4.5, stimmen: 212, haendler: 6,
      autor: "Solomon203", lizenz: "CC BY-SA 4.0", seite: "Delta_Electronics_EVPT3215MWE_20190601.jpg" },
    { id: "p3", t: "Tesla Wall Connector 11 kW", m: "te", preis: [549, 549],
      bild: "e/e3/TeslaDestinationCharger.jpg",
      vis: [24.1, 23.3], pos: [1.9, 1.8], note: 4.7, stimmen: 960, haendler: 4,
      autor: "Raysonho", lizenz: "CC0", seite: "TeslaDestinationCharger.jpg" },
    { id: "p4", t: "BMW iX xDrive60 Leasing from €999/month", m: "bm", preis: [999, 999],
      bild: "8/8d/Front_vom_BMW_iX_xDrive_60_in_der_BMW_Welt_M%C3%BCnchen_2025-04-15.jpg",
      vis: [18.6, 16.9], pos: [2.3, 2.4], note: null, stimmen: null, haendler: 2,
      autor: "Strubbl", lizenz: "CC BY-SA 4.0", seite: "Front_vom_BMW_iX_xDrive_60_in_der_BMW_Welt_M%C3%BCnchen_2025-04-15.jpg" },
    { id: "p5", t: "Audi Q4 e-tron 50 quattro", m: "au", preis: [59000, 59000],
      bild: "d/d6/Audi_Q4_e-tron_50_quattro_%E2%80%93_f_22012023.jpg",
      vis: [15.2, 16.6], pos: [2.7, 2.5], note: 4.5, stimmen: 640, haendler: 2,
      autor: "M 93", lizenz: "CC BY-SA 3.0 de", seite: "Audi_Q4_e-tron_50_quattro_%E2%80%93_f_22012023.jpg" },
    { id: "p6", t: "Thule Dynamic M Roof Box 320 L", m: null, marke: "Thule", preis: [749, 849],
      bild: "9/95/Thule_Dynamic_roof_box_%2811726731603%29.jpg",
      vis: [12.8, 12.1], pos: [2.9, 3.0], note: 4.6, stimmen: 388, haendler: 5,
      autor: "EHRENBERG Kommunikation", lizenz: "CC BY-SA 2.0", seite: "Thule_Dynamic_roof_box_(11726731603).jpg" },
    { id: "p7", t: "Acme All-Weather Floor Mats, 4-piece", m: "ac", preis: [69, 89],
      bild: "8/84/Tailored-rubber-mats-moulded-car-mats.jpg",
      vis: [11.4, 8.3], pos: [2.4, 2.8], note: 4.4, stimmen: 143, haendler: 4,
      autor: "Keystones", lizenz: "CC BY-SA 3.0", seite: "Tailored-rubber-mats-moulded-car-mats.jpg" },
    { id: "p8", t: "Volvo EX30 Single Motor Extended Range", m: "vo", preis: [41690, 41690],
      bild: "7/75/Volvo_EX30_1X7A2493.jpg",
      vis: [9.7, 14.9], pos: [3.1, 2.4], note: 4.3, stimmen: 512, haendler: 2,
      autor: "Alexander Migl", lizenz: "CC BY-SA 4.0", seite: "Volvo_EX30_1X7A2493.jpg" },
    { id: "p9", t: "Acme Type 2 Charging Cable 22 kW, 7 m", m: "ac", preis: [149, 229],
      bild: "6/6e/2015-12-23_Typ-2-Ladestecker.jpg",
      vis: [7.9, 7.6], pos: [3.0, 3.1], note: 4.6, stimmen: 98, haendler: 3,
      autor: "Hadhuey", lizenz: "CC BY-SA 4.0", seite: "2015-12-23_Typ-2-Ladestecker.jpg" },
    { id: "p10", t: "Porsche Taycan 4S", m: "po", preis: [125000, 130000],
      bild: "e/e5/Porsche_Taycan_4S_IMG_3526.jpg",
      vis: [5.2, 7.3], pos: [3.6, 3.2], note: 4.8, stimmen: 410, haendler: 1,
      autor: "Alexander Migl", lizenz: "CC BY-SA 4.0", seite: "Porsche_Taycan_4S_IMG_3526.jpg" }
  ];
  function echtesProdukt(id){ return ECHTE_PRODUKTE.filter(function(p){ return p.id === id; })[0]; }
  /* Die Produkte: Zubehoer, das Kaeufer eines Elektroautos wirklich in einem Shopping-Ergebnis
     sehen. Die Position ist ein Rang, also immer mit einer Nachkommastelle (CLAUDE.md 2b). */
  var PRODUKTE = [
    { t: "Acme Home Charger 11 kW",     m: "ac", vis: 34.2, pos: 1.4, haendler: 6 },
    { t: "Tesla Wall Connector",         m: "te", vis: 28.7, pos: 1.9, haendler: 4 },
    { t: "BMW Wallbox Plus",             m: "bm", vis: 19.5, pos: 2.6, haendler: 5 },
    { t: "Acme All-Weather Floor Mats",  m: "ac", vis: 14.8, pos: 2.2, haendler: 3 },
    { t: "Volvo Roof Box 420 L",         m: "vo", vis: 9.1,  pos: 3.4, haendler: 2 }
  ];
  /* Ad Share: fuenf Werbetreibende, der staerkste Balken fuellt die Spur (wie in Ads), daneben der
     echte Anteil. (Share of Shelf stand hier bis zum 06.10. -- die Karte zeigt jetzt die
     Produktbewegung.) */
  var WERBER = [
    { m: "ac", v: 34.6 }, { m: "bm", v: 22.1 }, { m: "te", v: 17.8 }, { m: "vo", v: 9.3 }, { m: "au", v: 6.2 }
  ];
  /* Drei Produkt-Ads in den Feldern der Ads-RPCs (ad_format, title, landing_domain, ...), so wie die
     Ad-Karte der App sie liest. Die Werbemittel sind ISOMETRISCHE Illustrationen (06.10. angefordert:
     "echte Produktads, gern isometrische Grafiken aus dem Internet, schoen minimalistisch"): ein
     Satz aus EINER Hand -- US EPA, ueber Openclipart, gemeinfrei (keine Nennung noetig). Eine isometrische
     Wallbox oder ein Kabel gibt es frei lizenziert nicht; fuer das Laden zu Hause steht deshalb das
     Haus.
     SEIT DEM 06.10. NACHTS IM REPO (landing-bilder/, vom Nutzer erlaubt). Vorher kamen sie ueber
     das Bild-CDN wsrv.nl -- schnell (55-64ms), aber ein fremder Dienst, an dem die Karte hing; und
     davor direkt von Openclipart, das ein selten angefragtes Bild erst bei Bedarf rechnet (gemessen
     28.8s fuer den Kompaktwagen). Jetzt liegen sie neben den Dateien der Seite und kommen aus
     demselben Pin wie alles andere (nebenDatei, wie die Titelbilder der Events): 480px WebP,
     15-17 KB, aus Openclipart 327138 (Limousine), 274743 (Kompaktwagen), 327136 (Haus).
     Faellt eines trotzdem aus, zeigt die Ad-Karte ihr Platzhalter-Zeichen -- dafuer sorgt core. */
  var ISO = {
    limousine: nebenDatei("landing-bilder/ad-limousine.webp"),
    kompakt:   nebenDatei("landing-bilder/ad-kompakt.webp"),
    haus:      nebenDatei("landing-bilder/ad-haus.webp")
  };
  /* Die Bilder der Sektion VORAB laden und dekodieren (06.10.): die Ad-Karte und die Zeilen von
     Shopping tragen loading="lazy" -- ein Bild beginnt dann erst zu laden, wenn es ins Bild kommt,
     und erscheint sichtbar spaet. Hier liegen sie schon im Speicher, wenn Karte oder Szene kommen;
     decode() nimmt ausserdem das Entpacken vorweg, das sonst mitten in eine Bewegung faellt. */
  function bilderVorladen(){
    if (bilderVorladen.fertig) return bilderVorladen.fertig;
    var urls = ECHTE_PRODUKTE.map(function(p){ return wikiBild(p.bild); })
      .concat([ISO.limousine, ISO.kompakt, ISO.haus]);
    bilderVorladen.fertig = Promise.all(urls.map(function(u){
      var i = new Image();
      i.decoding = "async";
      i.referrerPolicy = "no-referrer";
      i.src = u;
      return i.decode ? i.decode()["catch"](function(){}) : Promise.resolve();
    }));
    return bilderVorladen.fertig;
  }
  var ANZEIGEN = [
    { id: "lh-ad-1", m: "ac", beziehung: "you", advertiser_name: "Acme", ad_format: "product_card_v2",
      title: "Acme EX5 Touring", description: "Up to 610 km of range. 0.9% APR financing this month.",
      landing_domain: "acme.com", price: 49900, currency: "EUR", model: "chatgpt", market: "DE",
      image_url: ISO.limousine, observed_at: "2026-10-03T09:12:00Z" },
    { id: "lh-ad-2", m: "ac", beziehung: "you", advertiser_name: "Acme", ad_format: "product_card_v2",
      title: "Acme Home Charger 11 kW", description: "Charges an EX5 overnight. Installation included.",
      landing_domain: "acme.com", price: 799, currency: "EUR", model: "perplexity", market: "DE",
      image_url: ISO.haus, observed_at: "2026-10-02T16:40:00Z" },
    { id: "lh-ad-3", m: "vo", beziehung: "competitor", advertiser_name: "Volvo", ad_format: "image_card_v2",
      title: "Lease the EX30 from €349/month", description: "36 months, 10,000 km a year, delivery in 6 weeks.",
      landing_domain: "volvocars.com", model: "chatgpt", market: "DE",
      image_url: ISO.kompakt, observed_at: "2026-10-01T11:05:00Z" }
  ];
  function handelMarke(id){ return MARKEN.filter(function(x){ return x.id === id; })[0] || null; }

  /* EIN PRODUKT IN DER ZELLE der Shopping-Tabellen: Foto (.ush-bild), Titel und darunter die Marke
     (.ush-zweizeilig), die eigene mit der Marke "You" -- dieselben Klassen und dieselbe CSS
     (shopping.css) wie produktZelle in shopping.js. */
  function produktZelleHtml(p){
    var kern = window.UpstreemCore;
    var m = p.m ? handelMarke(p.m) : null;
    var marke = m ? m.name : "Other (unassigned)";
    var bild = '<span class="ush-bild has-img"><span class="ush-bild-ph">' + (kern ? kern.icon("image", 1.8) : "") + '</span>' +
      '<img src="' + wikiBild(p.bild) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
      ' title="Photo: ' + p.autor + ', ' + p.lizenz + ', Wikimedia Commons"' +
      ' onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/></span>';
    return '<span class="ulh-vis-prod">' + bild +
      '<span class="ush-zweizeilig"><span class="ush-titel">' + p.t + '</span>' +
        '<span class="ush-unter">' + marke + (p.m === "ac" ? '<span class="up-marke up-you">You</span>' : '') + '</span>' +
      '</span></span>';
  }
  function euro(n){ return "€" + Math.round(n).toLocaleString("en-US"); }
  function preisText(p){ return p.preis[0] === p.preis[1] ? euro(p.preis[0]) : euro(p.preis[0]) + "–" + euro(p.preis[1]); }

  /* Oben links: die Top Products, wie in der Uebersicht von Shopping -- mit den Fotos und nur den
     Spalten, die in einer Karte etwas sagen (06.10.: "hier natuerlich nur mit den wichtigen"):
     Produkt, Visibility, Position, Preis. Die fuenf sichtbarsten. */
  function visProdukte(){
    var kern = window.UpstreemCore;
    var kopf = ["Product", "Visibility", "Avg. Position", "Price"];
    var hash = kern && kern.HASH_ICON ? kern.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";
    var oben = ECHTE_PRODUKTE.slice().sort(function(a, b){ return b.vis[0] - a.vis[0]; }).slice(0, 5);
    /* Die Zahlenspalten knapp: der Titel ist das, was man liest (gemessen bei 1180px: mit 110/130/150
       war "Tesla Model Y Premi..." alles, was vom ersten Titel blieb). */
    var html = '<div class="ulh-vis-tab" style="--up-cols: minmax(0,1fr) 84px 108px 118px;">' +
      '<div class="up-row up-thead">' + kopf.map(function(t){
        return '<div class="up-td">' + t + '</div>'; }).join("") + '</div>';
    html += oben.map(function(p, i){
      return '<div class="up-row' + (i === 1 ? " is-mitte" : "") + '">' +
        '<div class="up-td">' + produktZelleHtml(p) + '</div>' +
        '<div class="up-td"><span class="up-num">' + proz(p.vis[0]) + '</span></div>' +
        '<div class="up-td"><span class="up-rank-group">' + hash + '<span class="up-num">' + eine(p.pos[0]) + '</span></span></div>' +
        '<div class="up-td"><span class="up-num">' + preisText(p) + '</span></div>' +
      '</div>';
    }).join("");
    return html + '</div>';
  }

  /* Oben rechts: die Produktbewegung von Shopping (zeichneBewegung in shopping.js) -- dieselben
     zwei Gruppen "Rising" und "Declining", dieselbe Zeile (Foto, Titel, Marke; rechts die
     Aenderung der Visibility als UC.trendChip und die Position vorher -> jetzt). Die Daten sind
     dieselben wie im Fenster oben (shopBewegung). */
  function visBewegung(){
    var kern = window.UpstreemCore;
    if (!kern) return "";
    function zeile(id){
      var p = echtesProdukt(id);
      var d = Math.round((p.vis[0] - p.vis[1]) * 10) / 10;
      var chip = kern.trendChip ? kern.trendChip(d, { decimals: true, suffix: "%" }) : "";
      return '<div class="up-row ush-zeile">' +
        '<div class="up-td">' + produktZelleHtml(p) + '</div>' +
        '<div class="up-td ush-bew-rechts">' +
          '<span class="ush-bew-zeile"><span class="ush-bew-lbl">Visibility</span>' + chip + '</span>' +
          '<span class="ush-bew-zeile ush-bew-pos"><span class="ush-bew-lbl">Position</span><span class="up-num">' + eine(p.pos[1]) + '</span>' +
            kern.icon("arrowRight", 2) + '<span class="up-num">' + eine(p.pos[0]) + '</span></span>' +
        '</div></div>';
    }
    function gruppe(titel, ic, ids){
      return '<div class="up-thead ush-gruppenkopf"><div class="up-th"><span class="ush-gruppen-ic">' + kern.icon(ic, 2) + '</span>' + titel + '</div></div>' +
        '<div class="up-tbody">' + ids.map(zeile).join("") + '</div>';
    }
    var mv = { auf: [], ab: [] };
    ECHTE_PRODUKTE.map(function(p){ return { id: p.id, d: p.vis[0] - p.vis[1] }; })
      .sort(function(a, b){ return b.d - a.d; })
      .forEach(function(x){ if (x.d > 0.5 && mv.auf.length < 2) mv.auf.push(x.id); });
    ECHTE_PRODUKTE.map(function(p){ return { id: p.id, d: p.vis[0] - p.vis[1] }; })
      .sort(function(a, b){ return a.d - b.d; })
      .forEach(function(x){ if (x.d < -0.5 && mv.ab.length < 2) mv.ab.push(x.id); });
    return '<div class="up-box ush-bewegung" style="--up-cols: minmax(0,1fr) auto">' +
      gruppe("Rising", "arrowUpRight", mv.auf) + gruppe("Declining", "arrowDownRight", mv.ab) + '</div>';
  }
  function visAnzeigen(){
    var kern = window.UpstreemCore;
    if (!kern || !kern.adCardHtml) return "";
    return '<div class="ulh-anz">' + ANZEIGEN.map(function(a){
      var m = handelMarke(a.m);
      return kern.adCardHtml(a, { logo: m ? m.logo : "", beziehung: a.beziehung, zeichen: "bank" });
    }).join("") + '</div>';
  }
  /* Die Balken fahren ein, wenn ihre Karte erscheint -- nicht beim Aufbau, sonst waere die
     Bewegung vorbei, bevor jemand bis hierher gescrollt hat. Der Anlass ist DERSELBE wie fuer die
     Karte selbst: die Klasse is-da, die auftritte() setzt (samt seiner Sicherung fuer Seiten ohne
     Bilder). 300ms danach, damit die Karte schon steht, wenn die Balken loslaufen. */
  function visBalkenFuellen(root){
    var kern = window.UpstreemCore;
    if (!kern || !kern.makeBarList) return;
    [].forEach.call(root.querySelectorAll("[data-ulh-balken]"), function(platz){
      if (platz.__ulhBalken) return;
      platz.__ulhBalken = true;
      /* Seit dem 06.10. gibt es nur noch die Werbetreibenden (das Regal ist der Produktbewegung
         gewichen) -- eine andere Angabe am Platz waere ein Fehler im Markup, also nichts zeichnen. */
      if (platz.getAttribute("data-ulh-balken") !== "werber") return;
      var daten = WERBER;
      var max = Math.max.apply(null, daten.map(function(d){ return d.v; })) || 1;
      var liste = kern.makeBarList({ mount: platz, isDark: function(){ return false; },
                                     fmt: function(v){ return proz(v); } });
      function zeichnen(){
        liste.render(daten.map(function(d, i){
          var m = handelMarke(d.m) || { name: d.m, logo: "" };
          return { key: d.m, name: m.name, share: d.v / max * 100, wert: proz(d.v), logo: m.logo,
                   color: kern.balkenGrau ? kern.balkenGrau(i, false) : "#1f1f1b" };
        }));
      }
      var karte = platz.closest(".ulh-card");
      if (!karte || karte.classList.contains("is-da")){ zeichnen(); return; }
      var mo = new MutationObserver(function(){
        if (!karte.classList.contains("is-da")) return;
        mo.disconnect();
        setTimeout(zeichnen, 300);
      });
      mo.observe(karte, { attributes: true, attributeFilter: ["class"] });
    });
  }

  function merkmalKarte(m, i){
    return '<article class="ulh-card ulh-auf" style="--ulh-w:' + m.breit + ';--auf:' + (i || 0) + '">' +
      '<h3 class="ulh-card-h">' + m.h + '</h3>' +
      '<p class="ulh-card-p">' + m.p + '</p>' +
      /* m.stil (06.10.): eine Vorschau, die die Geometrie einer anderen uebernimmt -- die
         Produkttabelle traegt die Masse der Prompt-Tabelle (ulh-vis-zeilen) samt Hover. */
      '<div class="ulh-vis ulh-vis-' + (m.stil || m.vis) + (m.stil ? " ulh-vis-" + m.vis : "") +
        '" data-ulh-vis="' + m.vis + '">' +
        /* up-root an der Vorschau, und das ist keine Kosmetik: die Marken der App (--vc-border,
           --vc-text, --vt-head-bg und der ganze Rest) stehen in core.css AUSSCHLIESSLICH an
           .up-root. Ohne diese Klasse fiel jede Farbe in den Vorschauen auf den Rueckfall zurueck
           -- gemessen: Schrift schwarz, Zellenrahmen 0px, Kopfzeile und Balkenspur durchsichtig.
           Ein LEERES .up-root ist dabei ungefaehrlich (die Nebenfenster oben machen es genauso);
           gefaehrlich war die Klasse nur an der Wurzel der Sektion, die selbst Komponenten
           enthaelt -- Begruendung am Anfang von landing-hero.css.
           data-up-keepclip dazu: core entklammert beim Mount jedes .up-root die Vorfahrenkette,
           und der Beschnitt hier ist gewollt (er haelt die Vorschau in der Karte). */
        '<div class="ulh-vis-in up-root" data-theme="light" data-isdark="no" data-up-keepclip>' +
          visInhalt(m.vis) + '</div>' +
      '</div>' +
    '</article>';
  }

  /* ---- Fuellung des Bandes ---- */
  function visSprachenFuellen(root){
    var kern = window.UpstreemCore;
    var spur = root.querySelector("[data-ulh-spur]");
    if (!spur || spur.__ulhVoll) return false;
    spur.__ulhVoll = true;
    var eine = SPRACHEN.map(function(p){
      /* marketChip aus core statt einer eigenen Flagge: Groesse, Radius, Grund und die Schrift des
         Kuerzels sollen die der App sein, und sie stehen dort an einem Stueck. */
      var markt = (kern && kern.marketChip) ? kern.marketChip(p.m) : "";
      return '<div class="ulh-pk">' +
               markt +
               '<span class="ulh-pk-t">' + p.t + '</span>' +
               volumenBalken(p.v) +
             '</div>';
    }).join("");
    /* Zweimal dieselbe Liste: das Band faehrt genau eine Haelfte weit und setzt dann zurueck --
       an dieser Stelle steht dasselbe Bild, also sieht man den Sprung nicht. */
    spur.innerHTML = eine + eine;
    return true;
  }

  /* ---- Fuellung der Bahnen ---- */
  function visModelleFuellen(root){
    var kasten = root.querySelector("[data-ulh-orb]");
    if (!kasten || kasten.__ulhVoll) return false;
    kasten.__ulhVoll = true;
    var bahnen = [[], [], []];
    ORBIT.forEach(function(m){ bahnen[m.bahn].push(m); });
    kasten.__ulhBahnen = bahnen.map(function(liste, i){
      var r = ORBIT_R[i];
      var ring = document.createElement("div");
      ring.className = "ulh-orb-ring";
      ring.style.width = ring.style.height = (r * 2) + "px";
      liste.forEach(function(m, j){
        /* Gleichmaessig verteilt und je Bahn versetzt gestartet: sonst stehen die Zeichen der drei
           Bahnen in einer Linie, und das liest sich als Speiche statt als Umlauf. */
        var w = (j / liste.length) * Math.PI * 2 + (i * 0.7);
        var chip = document.createElement("span");
        chip.className = "ulh-orb-chip";
        chip.style.left = (r + Math.cos(w) * r) + "px";
        chip.style.top  = (r + Math.sin(w) * r) + "px";
        chip.innerHTML = '<img alt="' + m.n + '" referrerpolicy="no-referrer" src="' +
          quellzeichen(m.d) + '"/>';
        ring.appendChild(chip);
      });
      kasten.appendChild(ring);
      return { el: ring, chips: [].slice.call(ring.querySelectorAll(".ulh-orb-chip")) };
    });
    return true;
  }

  /* ---- EIN Takt fuer beide Bilder ----
     Warum nicht als CSS-Animation: die Geschwindigkeit soll beim Ueberfahren weich fallen und
     danach weich zurueckkommen. Eine laufende CSS-Animation nimmt eine neue Dauer nicht weich an --
     sie rechnet die verstrichene Zeit auf den neuen Takt um, und das Bild springt. Hier ist die
     Geschwindigkeit ein Wert, der sich einem Ziel naehert; die Position wird aus ihr aufaddiert und
     kann darum nie springen.
     Ein Takt und nicht zwei: zwei rAF-Schleifen auf derselben Seite sind zwei Weckrufe je Bild.
     Er laeuft nur, solange eines der beiden Bilder im Blick ist -- ausserhalb schlaeft er.

     TEMPO_* sind Pixel bzw. Grad je Sekunde. LANGSAM ist ein Viertel: weniger sieht aus wie
     angehalten, mehr merkt man beim Ueberfahren nicht. */
  var TEMPO_BAND = 26, TEMPO_BAHN = 8.25, LANGSAM = 0.25;   /* die Bahnen um die Haelfte schneller als zuerst */
  var ANNAEHERUNG = 240;      /* ms bis auf ein Drittel des Unterschieds -- das ist das ease */

  function ulhTakt(root){
    if (root.__ulhTakt) return;
    root.__ulhTakt = true;
    var lauf = root.querySelector("[data-ulh-lauf]");
    var orb  = root.querySelector("[data-ulh-orb]");
    if (!lauf && !orb) return;
    /* Bei "weniger Bewegung" bleibt alles stehen -- ein Endlosband ist genau das, was diese
       Einstellung meint. */
    try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; }
    catch (e){}

    var ziel = { band: 1, bahn: 1 }, tempo = { band: 1, bahn: 1 };
    var y = 0, grad = 0, vorher = 0, imBlick = true;
    /* Gemerkt statt in jedem Bild gesucht und gemessen -- siehe die Begruendung in rechnen(). */
    var spur = null, halb = 0;
    window.addEventListener("resize", function(){ halb = 0; }, { passive: true });

    function hover(el, welche){
      if (!el) return;
      var karte = el.closest ? el.closest(".ulh-card") : null;
      var auf = karte || el;
      auf.addEventListener("mouseenter", function(){ ziel[welche] = LANGSAM; });
      auf.addEventListener("mouseleave", function(){ ziel[welche] = 1; });
    }
    hover(lauf, "band");
    hover(orb, "bahn");

    /* Nur laufen, wenn man es sehen kann. Ohne IntersectionObserver laeuft es immer -- das ist
       die alte Lage und nicht schlechter als vorher. */
    if (window.IntersectionObserver){
      var beo = new IntersectionObserver(function(e){
        imBlick = e.some(function(x){ return x.isIntersecting; });
      }, { rootMargin: "120px" });
      if (lauf) beo.observe(lauf);
      if (orb) beo.observe(orb);
    }

    /* Eine Handhabe zum NACHSEHEN und zum MESSEN, wie __ulhStand: sie gibt den Stand zurueck und
       laesst den Takt von Hand weiterlaufen. In einem verdeckten Tab feuert requestAnimationFrame
       nicht -- ohne diesen Weg waere die Bewegung hier nicht pruefbar, und "sieht richtig aus" ist
       keine Messung. */
    root.__ulhTakt3 = {
      stand: function(){ return { tempo: { band: tempo.band, bahn: tempo.bahn },
                                  ziel: { band: ziel.band, bahn: ziel.bahn },
                                  y: y, grad: grad, imBlick: imBlick }; },
      ziel: function(welche, wert){ ziel[welche] = wert; },
      schritt: function(ms){ rechnen(ms / 1000); }
    };

    function rechnen(dt){
      if (imBlick && dt){
        var k = 1 - Math.exp(-(dt * 1000) / ANNAEHERUNG);
        tempo.band += (ziel.band - tempo.band) * k;
        tempo.bahn += (ziel.bahn - tempo.bahn) * k;
        if (lauf){
          /* Spur und Hoehe stehen AUSSERHALB der Schleife. Vorher wurde in jedem Bild
             querySelector gerufen UND scrollHeight gelesen -- ein erzwungener Layoutdurchgang je
             Bild, mitten in einer Bewegung, die genau davon glatt sein muss. Auf einem schnellen
             Rechner faellt das nicht auf, auf einem langsameren zittert das Band. Gemeldet fuer
             Windows.
             Die Hoehe aendert sich nur, wenn die Karte ihre Breite aendert (Umbruch der Zeilen);
             dafuer gibt es den Zaehler unten. */
          if (!spur || !spur.isConnected){ spur = lauf.querySelector("[data-ulh-spur]"); halb = 0; }
          if (spur && !halb) halb = spur.scrollHeight / 2;
          if (halb > 0){
            y -= TEMPO_BAND * tempo.band * dt;
            if (y <= -halb) y += halb;                                  /* eine Haelfte weit, dann zurueck */
            spur.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";
          }
        }
        if (orb && orb.__ulhBahnen){
          grad += TEMPO_BAHN * tempo.bahn * dt;
          orb.__ulhBahnen.forEach(function(b, i){
            /* Die mittlere Bahn laeuft gegen die anderen und die aeussere langsamer: drei Kreise,
               die im Gleichschritt drehen, sehen aus wie EIN Bild, das sich dreht. */
            var richtung = (i === 1) ? -1 : 1;
            var eigen = grad * richtung * (i === 2 ? 0.72 : 1);
            b.el.style.transform = "rotate(" + eigen.toFixed(2) + "deg)";
            for (var q = 0; q < b.chips.length; q++){
              b.chips[q].style.transform = "translate(-50%,-50%) rotate(" + (-eigen).toFixed(2) + "deg)";
            }
          });
        }
      }
    }

    function schritt(jetzt){
      var dt = vorher ? Math.min(0.05, (jetzt - vorher) / 1000) : 0;   /* 50ms Deckel: nach einem
                                                                          verdeckten Tab nicht springen */
      vorher = jetzt;
      rechnen(dt);
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  /* Die zwei Kurven brauchen Chart.js und werden deshalb erst beim Fuellen gezeichnet. */
  function visLinieFuellen(root){
    var kern = window.UpstreemCore;
    var feld = root.querySelector(".ulh-krv");
    if (!feld || feld.__ulhKrv || !kern) return false;
    var leinwand = feld.querySelector("canvas");
    if (!leinwand) return false;
    feld.__ulhKrv = true;
    /* Chart.js kommt vom CDN und ist beim Fuellen noch nicht sicher da -- bereit() fragt es nicht
       ab. Erst hat diese Funktion deshalb bei fehlendem window.Chart aufgegeben und wurde nie
       wieder gerufen: gemessen stand die Karte ohne Kurve da (kein Chart, keine Schilder).
       loadChartJs ist derselbe Lader, den auch makeLine und makeTypeChart benutzen. */
    kern.loadChartJs().then(function(){ krvZeichnen(feld, leinwand); })["catch"](function(){});
    return true;
  }

  function krvZeichnen(feld, leinwand){
    if (!window.Chart) return false;
    var marken = KRV.map(function(k){
      return MARKEN.filter(function(x){ return x.id === k.id; })[0];
    });
    var chart = new window.Chart(leinwand.getContext("2d"), {
      type: "line",
      data: {
        labels: KRV[0].werte.map(function(_, i){ return String(i); }),
        datasets: KRV.map(function(k, i){
          /* Die eigene Farbe der Karte vor der Markenfarbe -- siehe KRV. __farbe traegt sie mit,
             weil krvHeben die Linie nach dem Grau wieder auf genau diesen Wert zuruecksetzt. */
          var farbe = k.farbe || marken[i].farbe;
          return { data: k.werte, borderColor: farbe, __farbe: farbe,
                   /* Einen Hauch dicker als der dicke Wert aus core (1.80625): die Kurve steht
                      hier allein in einer Karte und nicht als eine von sechs in einem Chart. */
                   borderWidth: 2.1, tension: 0.38, pointRadius: 0, pointHoverRadius: 0,
                   fill: false, cubicInterpolationMode: "default" };
        })
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        /* Kein Achsenkreuz und keine Legende: die Karte zeigt die BEWEGUNG, nicht die Skala. */
        scales: { x: { display: false }, y: { display: false, min: KRV_MIN, max: KRV_MAX } },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        /* Kein Zeiger-Verhalten am Chart selbst: gehoben wird von der Karte aus (siehe unten). */
        events: [],
        animation: { duration: 700, easing: "easeOutQuart" },
        layout: { padding: { top: 6, bottom: 4, left: 2, right: 2 } }
      }
    });
    feld.__ulhChart = chart;
    /* Die Schilder sitzen auf ihrem Punkt. Chart.js kennt seine Punktkoordinaten erst nach dem
       ersten Zeichnen, also danach setzen -- und bei jeder Groessenaenderung neu. */
    function schilderSetzen(){
      /* resize() VOR dem Messen: Chart.js richtet sich sonst nach der Groesse, die die Leinwand
         beim Anlegen hatte, und passt sie erst nach, wenn sein ResizeObserver feuert.
         Die Lage kommt aus den ACHSEN und nicht aus den gezeichneten Punkten. Das ist der
         Unterschied zwischen "geht immer" und "geht meistens": ein Punkt-Element steht bis zum
         Ende der Eingangsanimation an seiner Startlage, und die Animation haengt an
         requestAnimationFrame. Gemessen in einem verdeckten Tab, wo rAF nie feuert: ALLE Punkte
         lagen auf y = 204, also auf der Grundlinie, obwohl die Achse fuer 38.9 Prozent 44px
         ausrechnet. Aus der Achse gerechnet stimmt die Lage im ersten Bild. */
      try { chart.resize(); } catch (e){}
      var ax = chart.scales.x, ay = chart.scales.y;
      if (!ax || !ay) return;
      KRV.forEach(function(k, i){
        var schild = feld.querySelector('.ulh-krv-chip[data-krv="' + k.id + '"]');
        if (!schild) return;
        var x = ax.getPixelForValue(k.schild), y = ay.getPixelForValue(k.werte[k.schild]);
        /* In das Feld hineinschieben. Das Schild sitzt mittig auf seinem Punkt (translate -50%),
           also ragt es um seine halbe Breite darueber hinaus -- am letzten Punkt der Kurve war das
           gemessen ein Drittel des Schildes ausserhalb. Geklemmt statt am Punkt verankert: so
           bleibt es an seiner Kurve, auch wenn sich Werte oder Breite aendern. */
        var hw = schild.offsetWidth / 2, hh = schild.offsetHeight;
        var bx = feld.clientWidth;
        x = Math.min(Math.max(x, hw + 3), bx - hw - 3);
        /* Der Strich haengt MITTIG unter dem Schild und ist immer gleich lang. Damit er auf der
           Linie endet, richtet sich die HOEHE des Schildes nach dem Wert der Kurve an genau der
           Stelle, an der das Schild steht -- und nicht nach dem Wert seines Punktes. Der
           Unterschied faellt nur beim letzten Punkt auf, wo das Schild nach links geschoben wird,
           damit es im Feld bleibt: dort lag der Strich vorher 66px neben der Linie.
           Der Wert dazwischen wird linear genommen. Die Kurve ist leicht gerundet (tension 0.38),
           der Fehler daraus liegt im Bereich eines Pixels. */
        var idx = ax.getValueForPixel ? ax.getValueForPixel(x) : k.schild;
        idx = Math.max(0, Math.min(k.werte.length - 1, idx));
        var i0 = Math.floor(idx), i1 = Math.min(k.werte.length - 1, i0 + 1);
        var wert = k.werte[i0] + (k.werte[i1] - k.werte[i0]) * (idx - i0);
        /* Das Schild steht UEBER der Linie, nicht darauf: darauf deckt es sie zu. */
        y = Math.max(ay.getPixelForValue(wert) - KRV_ABSTAND - (k.hoch || 0), hh + 3);
        schild.style.left = Math.round(x) + "px";
        schild.style.top = Math.round(y) + "px";
        schild.classList.add("is-da");
      });
    }
    setTimeout(schilderSetzen, 60);
    setTimeout(schilderSetzen, 760);
    if (typeof ResizeObserver !== "undefined"){
      try { new ResizeObserver(function(){ setTimeout(schilderSetzen, 40); }).observe(feld); } catch (e){}
    }
    /* Gehoben wird beim Ueberfahren der KARTE und nur die eigene Marke. Zwei Aenderungen gegen
       die erste Fassung, beide vom Nutzer: die Linie einer fremden Marke hervorzuheben sagt
       nichts, und eine Linie in einer Vorschau genau zu treffen ist eine Zumutung -- die Karte
       ist das Ziel, das man ohnehin trifft. */
    var karte = feld.closest ? feld.closest(".ulh-card") : null;
    var eigene = 0;
    KRV.forEach(function(k, i){ if (k.id === MARKEN[0].id) eigene = i; });
    if (karte){
      karte.addEventListener("mouseenter", function(){ krvHeben(feld, eigene); });
      karte.addEventListener("mouseleave", function(){ krvHeben(feld, -1); });
    }
    return true;
  }

  /* Eine Linie heben heisst: die ANDERE tritt zurueck. Genau so macht es die App, wenn man in der
     Legende eine Marke ueberfaehrt -- die uebrigen gehen ins Grau, statt dass die gewaehlte
     aufleuchtet. Grau kommt aus core (CHART_OTHER_LIGHT). */
  function krvHeben(feld, welche){
    var chart = feld.__ulhChart;
    var kern = window.UpstreemCore;
    if (!chart) return;
    var grau = (kern && kern.CHART_OTHER_LIGHT) || "#8c8f96";
    chart.data.datasets.forEach(function(ds, i){
      var aus = welche >= 0 && i !== welche;
      ds.borderColor = aus ? grau : ds.__farbe;
      ds.borderWidth = aus ? 1.4 : 2.1;
    });
    chart.update("none");
    KRV.forEach(function(k, i){
      var schild = feld.querySelector('.ulh-krv-chip[data-krv="' + k.id + '"]');
      if (schild) schild.classList.toggle("is-aus", welche >= 0 && i !== welche);
    });
  }

  function merkmale(){
    /* Zwei Reihen und kein Raster: die obere Reihe teilt sich 40/60, die untere 60/40, und ein
       CSS-Raster kann seine Spalten nicht je Zeile anders legen. Zwei Flexzeilen koennen es, und
       der Anteil steht als Zahl an der Karte (--ulh-w).
       Um die vier Karten liegt ein KASTEN: er traegt den off-white Grund, auf dem die Karten in
       reinem Weiss erst als Karten lesbar sind, und er haelt 8px Abstand zu den Schienen des
       Gitters -- die Karten beruehren die Kante der Seite damit nie. */
    return '<section class="ulh-feat">' +
      '<div class="ulh-spur">' +
        '<div class="ulh-feat-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + MERKMAL_CHIP + '</span>' +
          '<h2 class="ulh-feat-h">' + MERKMAL_H + '</h2>' +
          '<p class="ulh-feat-sub">' + MERKMAL_SUB + '</p>' +
        '</div>' +
        '<div class="ulh-cards-box">' +
          '<div class="ulh-cards">' +
            '<div class="ulh-cards-row">' + merkmalKarte(MERKMALE[0], 0) + merkmalKarte(MERKMALE[1], 1) + '</div>' +
            '<div class="ulh-cards-row is-unten">' + merkmalKarte(MERKMALE[2], 0) + merkmalKarte(MERKMALE[3], 1) + '</div>' +
            /* Die dritte Reihe teilt sich 50/50 -- deshalb steht der Anteil an der Karte und nicht
               an der Reihe (--ulh-w, siehe merkmalKarte). */
            '<div class="ulh-cards-row">' + merkmalKarte(MERKMALE[4], 0) + merkmalKarte(MERKMALE[5], 1) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* Der Block "Beyond classic GEO" -- Bau wie merkmale(): Kopf, Kasten, zwei Reihen. */
  function handel(){
    return '<section class="ulh-feat ulh-handel">' +
      '<div class="ulh-spur">' +
        '<div class="ulh-feat-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + HANDEL_CHIP + '</span>' +
          '<h2 class="ulh-feat-h">' + HANDEL_H + '</h2>' +
          '<p class="ulh-feat-sub">' + HANDEL_SUB + '</p>' +
        '</div>' +
        '<div class="ulh-cards-box">' +
          '<div class="ulh-cards">' +
            '<div class="ulh-cards-row">' + merkmalKarte(HANDEL[0], 0) + merkmalKarte(HANDEL[1], 1) + '</div>' +
            '<div class="ulh-cards-row">' + merkmalKarte(HANDEL[2], 0) + merkmalKarte(HANDEL[3], 1) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---------- Events (06.10. angefordert: "unter den Beyond-Cards ein 1x2-Element: Events") ----
     Links ein Event, wie es in der App als Karte steht (events.js, karteHtml -- Band mit dem
     Titelbild, Zeichen, Titel, Datum und Typ, Text, drei Kennzahlen; dieselben Klassen aus
     events.css), am Beispiel des Relaunchs der Acme-Webseite mit dem blauen Titelbild.
     Rechts die Wirkung, wie sie das Event-Detail zeigt: UC.makeLine mit den betroffenen Prompts und
     dem Pin des Events auf der Zeitachse (Tooltip und Vergleichsgruppe sind seit dem 06.10. abends
     weg, angefordert). */
  var EVENT_CHIP = "Events";
  /* KEIN "LAUNCH" MEHR (06.10. nachts: "da steht ueberall das Wort Launch -- das ist ein Feature,
     um den Impact von Massnahmen wirklich zu messen"). Die Texte sprechen jetzt von Massnahmen
     (initiative) und von MESSEN; das Beispiel-Event selbst bleibt der Relaunch von
     acme.com/electric, so angefordert. */
  var EVENT_H = "Measure what really moved your visibility";
  var EVENT_SUB = "Log content updates, campaigns and price changes, then measure the impact of each " +
    "one against a comparison group.";
  var EVENTKARTEN = [
    /* Nach der Recherche (06.10. spaet, Begruendung bei MERKMALE): die Vergleichsgruppe ist das,
       was die Wirkung BELEGT -- deshalb "Prove" und die Gruppe in der Unterzeile. */
    { breit: 40, vis: "eventkarte",
      h: "Put every initiative on the timeline",
      p: "Content updates, campaigns and price changes sit on your visibility chart, so every shift has a known cause." },
    { breit: 60, vis: "eventkurve",
      h: "Prove the impact of each initiative",
      p: "Affected prompts from day one, measured against an untouched comparison group, so noise never passes as impact." }
  ];
  var EVENT_TON = "#3b82f6";
  var EVENT_NAME = "acme.com/electric relaunch";
  /* Die Titelbilder liegen neben den Dateien der App (event-covers/, wie in events.js). Die Adresse
     kommt aus dem Lader: landing-boot.js traegt jede geladene Datei in __upAssetsLoaded ein. Ohne
     ihn (Messaufbau) der Pfad neben der Seite. */
  function nebenDatei(datei){
    var u = String((window.__upAssetsLoaded || {})["landing-hero.js"] || "").replace(/[?#].*$/, "");
    return /landing-hero(\.min)?\.js$/.test(u) ? u.replace(/landing-hero(\.min)?\.js$/, datei) : datei;
  }
  function eventKarteHtml(ev, klasse){
    var kern = window.UpstreemCore;
    var ic = function(n){ return kern ? kern.icon(n, 2) : ""; };
    return '<article class="uev-karte is-vorschau has-cover' + (klasse ? " " + klasse : "") + '" aria-hidden="true" style="--uev-ton:' + ev.ton + '">' +
      '<div class="uev-karte-band has-cover" style="background-image:url(' + nebenDatei("event-covers/" + ev.cover) + ');background-position:50% ' + ev.pos + '"></div>' +
      '<div class="uev-karte-body">' +
        '<span class="uev-avatar" style="--uev-ton:' + ev.ton + '" aria-hidden="true">' + ic(ev.icon) + '</span>' +
        '<h3 class="uev-karte-titel">' + ev.name + '</h3>' +
        '<div class="uev-angaben uev-karte-meta">' +
          '<span class="uev-angabe uev-angabe-datum">' + ic("calendar") + '<span>' + ev.datum + '</span></span>' +
          '<span class="up-marke is-leise">' + ev.typ + '</span>' +
        '</div>' +
        '<p class="uev-karte-text">' + ev.text + '</p>' +
        '<dl class="uev-stats">' +
          '<div class="uev-stat"><dt>Topics</dt><dd>' + ev.topics + '</dd></div>' +
          '<div class="uev-stat"><dt>Prompts</dt><dd>' + ev.prompts + '</dd></div>' +
          '<div class="uev-stat"><dt>URLs</dt><dd>' + ev.urls + '</dd></div>' +
        '</dl>' +
      '</div>' +
    '</article>';
  }
  /* DREI KARTEN IM FAECHER (06.10. angefordert: "wie bei unseren Fanned Logo Chips, auch rechts
     hinter der vorderen Card ein Event, Versatz minimal groesser, links z.B. eine Marketingkampagne").
     Dieselbe Bauart wie UC.makeFaecher: alle drei liegen auf EINEM Platz und drehen um einen Punkt
     weit unter sich (landing-hero.css, .ulh-evkarten), die Mitte vorn. Sie faechern auf, wenn die
     Karte erscheint -- vorher liegen sie aufeinander. In der Reihenfolge des Markups: die beiden
     hinteren zuerst, damit die vordere ohne z-index oben liegt. */
  function visEventKarte(){
    return '<div class="ulh-evkarten">' +
      eventKarteHtml({ name: "EX5 autumn campaign", ton: "#d9577f", cover: "wave-pink.svg", pos: "78%", icon: "megaphone",
                       datum: "Aug 4, 2026", typ: "Brand campaign", text: "Video and social for the EX5, in five markets.",
                       topics: "4", prompts: "96", urls: "12" }, "ulh-evkarte-links") +
      eventKarteHtml({ name: "New lease rates", ton: "#0f9b8e", cover: "wave-teal.svg", pos: "70%", icon: "euro",
                       datum: "Sep 1, 2026", typ: "Pricing change", text: "Lower monthly rates across the EX range.",
                       topics: "2", prompts: "58", urls: "6" }, "ulh-evkarte-rechts") +
      /* Vorn der Relaunch der Seite acme.com/electric (06.10. spaet angefordert) -- eine Seite,
         keine ganze Domain: die Zahlen sind entsprechend kleiner, und der Pin in der Kurve
         daneben traegt denselben Namen (EVENT_NAME). */
      eventKarteHtml({ name: EVENT_NAME, ton: EVENT_TON, cover: "wave-blue.svg", pos: "55%", icon: "globe",
                       datum: "Sep 15, 2026", typ: "Website relaunch",
                       text: "The new EV hub: range calculator, model comparison and an FAQ for every model.",
                       topics: "3", prompts: "86", urls: "12" }, "ulh-evkarte-vorn") +
    '</div>';
  }
  /* Die Kurve: 28 Tage, der Relaunch am 15. Die betroffenen Prompts stehen davor bei gut 21
     Prozent und ziehen danach auf rund 31 an; die Vergleichsgruppe bleibt bei 19 bis 20. Feste
     kleine Wellen statt Zufall -- in jeder Runde dasselbe Bild. */
  function eventKurveDaten(){
    var tage = [], betroffen = [], vergleich = [], start = Date.UTC(2026, 8, 1);
    for (var i = 0; i < 28; i++){
      tage.push(new Date(start + i * 864e5).toISOString().slice(0, 10));
      var nach = Math.max(0, i - 14), anstieg = 9.6 * (1 - Math.exp(-nach / 4.2));
      betroffen.push(Math.round((21.4 + anstieg + Math.sin(i * 1.3) * 0.7) * 10) / 10);
      vergleich.push(Math.round((19.6 + Math.sin(i * 0.9 + 1) * 0.6) * 10) / 10);
    }
    return { tage: tage, betroffen: betroffen, vergleich: vergleich };
  }
  function visEventKurveFuellen(root){
    var kern = window.UpstreemCore;
    var feld = root.querySelector("[data-ulh-evk]");
    if (!kern || !kern.makeLine || !feld || feld.__ulhEvk) return;
    feld.__ulhEvk = true;
    var wrap = feld.querySelector(".ulh-evk-wrap"), leinwand = feld.querySelector("canvas");
    function zeichnen(){
      var d = eventKurveDaten();
      var tinte = kern.chartInk ? kern.chartInk(feld) : "#1f1f1b";
      /* OHNE TOOLTIP, ABER MIT VERGLEICHSGRUPPE UND LEGENDE (06.10. spaet richtiggestellt: weg
         sollte nur der Tooltip, die gestrichelte Vergleichslinie und die Legende gehoeren dazu).
         Den Tooltip beim Ueberfahren nimmt landing-hero.css (.ulh-evk canvas). */
      var linie = kern.makeLine({
        wrap: wrap, canvas: leinwand, legend: feld.querySelector(".up-legend"),
        isDark: function(){ return false; }, gran: function(){ return "day"; },
        unit: function(){ return "%"; }, decimals: function(){ return 1; },
        tipLabel: function(){ return "Visibility:"; }, legendeImmer: true,
        markers: function(){ return [{ id: "lh-ev1", date: "2026-09-15", name: EVENT_NAME,
                                       type: "website_relaunch", color: EVENT_TON, fokus: true }]; }
      });
      linie.render({ labels: d.tage, datasets: [
        { label: "Affected prompts", __id: "affected", __baseColor: tinte, borderColor: tinte, data: d.betroffen },
        { label: "Comparison group", __id: "comparison", __baseColor: "#80858e", borderColor: "#80858e", __dash: true, data: d.vergleich }
      ] });
    }
    /* Wie die Balken: gezeichnet wird, wenn die Karte erscheint -- sonst waere das Aufziehen der
       Linien vorbei, bevor jemand bis hierher scrollt. */
    var karte = feld.closest(".ulh-card");
    if (!karte || karte.classList.contains("is-da")){ zeichnen(); return; }
    var mo = new MutationObserver(function(){
      if (!karte.classList.contains("is-da")) return;
      mo.disconnect();
      setTimeout(zeichnen, 300);
    });
    mo.observe(karte, { attributes: true, attributeFilter: ["class"] });
  }
  function ereignisse(){
    return '<section class="ulh-feat ulh-handel ulh-events">' +
      '<div class="ulh-spur">' +
        '<div class="ulh-feat-kopf ulh-auf">' +
          '<span class="ulh-feat-chip">' + EVENT_CHIP + '</span>' +
          '<h2 class="ulh-feat-h">' + EVENT_H + '</h2>' +
          '<p class="ulh-feat-sub">' + EVENT_SUB + '</p>' +
        '</div>' +
        '<div class="ulh-cards-box">' +
          '<div class="ulh-cards">' +
            '<div class="ulh-cards-row">' + merkmalKarte(EVENTKARTEN[0], 0) + merkmalKarte(EVENTKARTEN[1], 1) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---------- Dritte Sektion: die Quellen ----------------------------------------------------
     Aufbau wie die Vorlage, an der sich diese Seite orientiert: farbiger Chip, EINE grosse
     Ueberschrift in zwei Toenen (der erste Satz dunkel, der Rest in der zweiten Farbe), ein Knopf,
     und darunter ein Stueck der App -- angeschnitten, nicht als Bild in einem Rahmen. Die Sektion
     zeigt genau eine Sache: was hinter einer Antwort steckt, am Beispiel einer Domain.

     Die Domain ist forbes.com und nicht erfunden: die Sektion behauptet nichts ueber diese Seite,
     sondern zeigt, WAS die App ueber eine Quelle weiss -- und ein erfundener Name waere hier das
     Gegenteil von dem, was gemeint ist ("die echten Quellen deines Marktes"). Die Zahlen sind
     Beispielzahlen und stehen in derselben Groessenordnung wie im Dashboard darueber. */
  var QUELL_CHIP = "Source Insights";
  var QUELL_H1 = "Understand how sources shape answers.";
  var QUELL_H2 = "Which domains the models cite in your market, which of their pages carry the " +
    "answer, and where your brand is named in them.";
  var QUELL_CTA = "Start for free";
  /* Die Beispiel-Domain ist forbes.com (21.09. angefordert, mit Beispielseiten). Dasselbe
     Argument wie vorher: eine Quelle, die in Antworten ueber Autos wirklich vorkommt, und
     dieselbe Domain steht auch oben in der Zitattabelle. Die fuenf Seiten unten sind echte
     Formen dieser Redaktion -- Bestenlisten, ein Einzeltest, ein Ratgeber --, und keine von
     ihnen behauptet ein Testergebnis fuer einen Hersteller: gezeigt wird der Anteil, den die
     SEITE an ACMES Antworten hat, und Acme ist erfunden. */
  var QUELL_DOMAIN = "forbes.com";

  /* ---- DIE FARBEN DER QUELLEN-SEKTION (28.09. angefordert) --------------------------------
     DIE BLAUE FAMILIE UNTEN GALT BIS ZUM 06.10. -- seitdem kommen die Farben aus core (siehe den
     Absatz direkt ueber QUELL_FARBEN). Die Herleitung bleibt als Geschichte stehen.
     "Die Farben sind noch sehr wild. URL-Type-Farben die bleiben. Aber alle anderen [...]
     harmonischer, professioneller und schoener. Linear-Farben als Base vielleicht? Aber so, dass
     es ins Gesamtfarbkonzept passt und wirklich subtil und professionell aussieht."
     Vorher standen hier vier Farbwelten nebeneinander: Kurven und Trichter im Cyan des
     Zitationstyps UGC (#34a1d1, dazu fuenf Abstufungen), die Modellbalken in den Markenfarben der
     Modelle (Schwarz #111827, Petrol #20808d, Google-Blau #4285F4, Claude-Orange #d97757), und
     dazwischen der Ring der URL-Typen. Das waren zu viele Aussagen fuer eine Karte.
     Jetzt EINE Familie, abgeleitet und nicht erfunden -- aus den zwei Toenen, die diese Seite
     ohnehin traegt, in OKLCH gemessen:
       - die Grautoene der Seite (--ulh-muted #6f737c, --ulh-sub #767a82, --ulh-border #e0e2e6)
         liegen alle bei Farbton 265 mit fast keiner Buntheit (0.006 bis 0.015),
       - der blaue Faden (Chip #3b82f6, Leitlinie #2563eb, Acme #579cf1) liegt bei 255 bis 263.
     Die Familie steht dazwischen, bei Farbton 262, und laeuft von einem gedeckten Blau zum
     Grau der Seite: je heller die Stufe, desto weniger bunt. Das ist Linears Art, Daten zu
     faerben -- ein Akzent, Abstufungen desselben Tons, der Rest tritt zurueck -- mit dem Blau
     dieser Seite statt Linears Violett. Die Buntheit bleibt unter 0.13 (der Chip hat 0.19):
     die Karte soll ruhig sein, nicht leuchten.
     Stufen von Hand gesetzt (L/C in OKLCH), wie die Skalen in core.css -- kein Faktor, der
     Zwischenwerte erzeugt:
       linien    Kurven der fuenf URLs, nach Anteil: die staerkste Seite im Akzent, jede weitere
                 heller und grauer. Die Tooltip-Kaestchen nehmen dieselben Farben.
                 1 #3f66b0  L .52 C .125   Akzent
                 2 #6083c2  L .61 C .105
                 3 #7f9cd1  L .69 C .085
                 4 #9cb2d9  L .76 C .062
                 5 #b4c5e2  L .82 C .045   die leiseste Stufe: auf Weiss noch 1.75:1 -- eine
                                           Stufe heller (L .86) war als 2px-Linie kaum noch da
       modelle   die vier Modellbalken, nach Anteil -- dieselben ersten vier Stufen. Die Modelle
                 erkennt man an Logo und Namen neben dem Balken; ihre Markenfarben waren eine
                 zweite Farbwelt neben dem Ring.
       trichter  die Flaeche des Trichters: Stufe 3. Die Deckkraft stuft core weiter ab
                 (0.92/0.74/0.56), also bleibt die Aussage "immer weniger". Stufe 2 stand im
                 Vergleich als schwerer blauer Block da -- es ist die groesste Farbflaeche der
                 Sektion, und eine Flaeche traegt eine hellere Stufe als eine 2px-Linie.
     Die URL-Typen (der Ring) bleiben ausdruecklich, wie sie sind. */
  /* SEIT DEM 06.10. AUS CORE (angefordert: "Linechart und Funnelchart sind immer noch im blauen
     Gradient"). Die Domain-Detail-Seite der App zeichnet Kurven, Trichter, Ring und Balken aus
     UC.chartFamilie -- im Standard die Stufen von Schwarz nach Grau. Ring und Balken taten das hier
     schon (sie fragen core selbst), Kurven und Trichter trugen noch das Blau von unten. Jetzt
     dieselbe Familie, in derselben Ordnung: Kurven nach Anteil, Modelle die ersten vier Stufen,
     der Trichter Stufe 3. Der Rueckfall (core noch nicht da -- etwa wenn landing-boot.js core von
     der zweiten Quelle nachholt und diese Datei dadurch vorher laeuft) ist dieselbe Familie als
     Zahlen, am 06.10. aus UC.chartFamilie(false) abgelesen -- und nicht mehr das Blau. */
  var QUELL_FARBEN = (function(){
    var k = window.UpstreemCore, f = k && typeof k.chartFamilie === "function" ? k.chartFamilie(false) : null;
    if (!f || f.length < 5) f = ["#1f1f1b", "#585c63", "#80858e", "#adb0b5", "#cfd0d3"];
    return { linien: f.slice(0, 5), modelle: f.slice(0, 4), trichter: f[2] };
  })();

  /* Jeden BUCHSTABEN einzeln, damit die Farbe wirklich durch den Satz laeuft und nicht in
     Wortsprüngen. Die Buchstaben stecken in Wortkasten: ein Zeilenumbruch darf zwischen zwei
     Woertern liegen, nie zwischen zwei Buchstaben -- ohne den Kasten bricht der Browser mitten im
     Wort um, weil jeder Buchstabe ein eigenes Inline-Element ist. */
  function quellWorte(){
    return (QUELL_H1 + " " + QUELL_H2).split(/\s+/).map(function(w){
      return '<span class="ulh-qwort">' + w.split("").map(function(c){
        return '<span class="ulh-qw">' + (c === "&" ? "&amp;" : c) + '</span>';
      }).join("") + '</span>';
    }).join(" ");
  }

  /* ---------- Wo steht ein Element WIRKLICH auf dem Bildschirm? -----------------------------
     Das ist die Frage, an der der Scrolleffekt zuerst gescheitert ist. Auf einer gewoehnlichen
     Seite beantwortet sie getBoundingClientRect: die Lage im Fenster, und die wandert beim
     Scrollen. In Framer steckt diese Sektion aber in einem EIGENEN RAHMEN, und darin bewegt sich
     nichts: der Rahmen ist so hoch wie sein Inhalt, das Fenster darin scrollt nie, und jede
     Elementlage bleibt konstant. Der Effekt fror deshalb auf dem Stand ein, den die Seite beim
     Aufbau gerade hatte -- gemeldet als "da ist einfach ein Verlauf mitten im Satz".
     Was sich sehr wohl bewegt, ist der RAHMEN im Fenster darueber. Also: Lage des Rahmens plus
     Lage im Rahmen, und die Fensterhoehe des Elternfensters. Dieselbe Ueberlegung, aus der das
     Hauptfenster oben seine vier Erkennungswege hat.
     Faellt der Zugriff aus (fremde Herkunft), bleibt es bei der eigenen Lage -- dann steht der
     Effekt still, statt falsch zu laufen. */
  function lage(el){
    var r = el.getBoundingClientRect();
    var oben = r.top;
    var hoehe = window.innerHeight || document.documentElement.clientHeight || 800;
    try {
      var rahmen = window.frameElement;
      if (rahmen){
        var rr = rahmen.getBoundingClientRect();
        var aussen = rahmen.ownerDocument && rahmen.ownerDocument.defaultView;
        oben = rr.top + r.top;
        if (aussen && aussen.innerHeight) hoehe = aussen.innerHeight;
      }
    } catch (e){}
    return { oben: oben, hoehe: hoehe, hoch: r.height };
  }

  /* ---------- Auftritte beim Scrollen -------------------------------------------------------
     Jedes Stueck der Seite ausser der Ueberschrift des Hero kommt herein, sobald es hochgescrollt
     wird: leicht von unten, weich, und Geschwister versetzt. Die Verzoegerung steht als --auf am
     Element, die Kurve in der CSS.
     EINE Schleife fuer alles, und keine Scroll-Ereignisse: im Rahmen von Framer feuert beim
     Scrollen der Seite kein einziges scroll-Ereignis, und ein IntersectionObserver haette dort
     alles auf einmal als sichtbar gemeldet (der Rahmen ist so hoch wie sein Inhalt). Die Schleife
     misst stattdessen jedes Bild die echte Lage (siehe lage). Sie haelt sich klein: erledigte
     Stuecke fallen aus der Liste, und wenn nichts mehr aussteht, bleibt nur die Ueberschrift. */
  function auftritte(root){
    var ruhig = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stuecke = [].slice.call(root.querySelectorAll(".ulh-auf"));
    var h = root.querySelector(".ulh-quell-h");
    var buchstaben = h ? [].slice.call(h.querySelectorAll(".ulh-qw")) : [];
    if (ruhig){
      stuecke.forEach(function(el){ el.classList.add("is-da"); });
      buchstaben.forEach(function(b){ b.style.setProperty("--t", "1"); });
      return;
    }
    /* Die Schwelle: ein Stueck ist "da", sobald seine Oberkante 88 Prozent der Fensterhoehe
       erreicht hat -- also kurz nachdem es unten hereinkommt. Frueher waere es unsichtbar
       animiert, spaeter erschiene es erst, wenn man es schon liest. */
    var SCHWELLE = 0.88;
    /* Grosse Bloecke spaeter. Bei 88 Prozent Fensterhoehe faengt die Bewegung an, sobald die
       OBERKANTE hereinkommt -- bei einem 750px hohen Kasten ist sie damit vorbei, bevor man ihn
       ueberhaupt ansieht. Solche Bloecke tragen .ulh-auf-gross und starten erst, wenn sie ein
       gutes Stueck im Bild stehen. */
    var SCHWELLE_GROSS = 0.62;
    var bilder = 0;
    function alleSofort(){
      stuecke.forEach(function(el){ el.classList.add("is-da"); });
      stuecke.length = 0;
      buchstaben.forEach(function(b){ b.style.setProperty("--t", "1"); });
      buchstaben.length = 0;
    }
    /* Sicherung: laeuft kein einziges Bild, ist die Seite LEER -- die Stuecke stehen ja auf
       Deckkraft 0 und warten auf ihre Klasse. Genau das kann passieren, wenn der Browser die
       Seite in einem Zustand aufbaut, in dem er keine Bilder zeichnet (verdeckter Tab, Aufnahme,
       Druckansicht). Nach drei Sekunden ohne ein einziges Bild ist alles da, ohne Bewegung.
       Kommt spaeter doch ein Bild, laeuft die Schleife weiter -- sie hat dann nichts mehr zu tun. */
    setTimeout(function(){ if (!bilder) alleSofort(); }, 3000);
    (function takt(){
      bilder++;
      for (var i = stuecke.length - 1; i >= 0; i--){
        var l = lage(stuecke[i]);
        var g = stuecke[i].classList.contains("ulh-auf-gross") ? SCHWELLE_GROSS : SCHWELLE;
        if (l.oben < l.hoehe * g){
          stuecke[i].classList.add("is-da");
          stuecke.splice(i, 1);
        }
      }
      if (buchstaben.length && h) schriftTakt(h, buchstaben);
      requestAnimationFrame(takt);
    })();
  }

  /* ---------- Die Leiste in die Seite DARUEBER haengen -------------------------------------
     Steckt die Sektion in einem Embed-Rahmen, kann sie von innen nicht kleben: sticky kennt nur
     seinen eigenen Scrollkasten, und der Rahmen scrollt nie -- er ist so hoch wie sein Inhalt.
     Nachfuehren aus JavaScript sieht man (ein Bild Verzoegerung, gemeldet als "zieht komisch
     nach"). Es bleibt genau ein Weg, der NATIV ist: das Element muss in dem Dokument stehen, das
     wirklich scrollt.

     Was dabei mitgeht und warum es sicher ist: die CSS der Sektion. Sie wird als dasselbe
     link-Tag in den Kopf der Seite darueber gehaengt -- dieselbe Adresse, also derselbe Pin.
     landing-hero.css enthaelt KEINEN einzigen Selektor ohne .ulh-Praefix (nachgezaehlt: null),
     kann die Seite darueber also nicht umgestalten. Die Leiste selbst haengt in einem Kasten mit
     der Klasse .ulh-root, weil ihre Masse und Farben aus dessen Variablen kommen; .ulh-nav-host
     nimmt diesem Kasten seinen Grund und seinen Ausschnitt wieder ab.

     Bei fremder Herkunft faellt alles aus (der Zugriff wirft) -- dann bleibt es bei sticky im CSS.
     Und wer das nicht will, nimmt data-nav-host="no" an die Wurzel: dann bleibt die Leiste, wo
     sie ist. */
  function leisteAuslagern(root){
    if (root.getAttribute("data-nav-host") === "no") return;
    var nav = root.querySelector(".ulh-nav");
    if (!nav) return;
    var rahmen, aussen;
    try { rahmen = window.frameElement; } catch (e){ return; }
    if (!rahmen) return;                       /* keine Einbettung: sticky reicht */
    try { aussen = rahmen.ownerDocument; } catch (e){ return; }
    if (!aussen || !aussen.body) return;
    /* Schon da -- zweites Embed auf derselben Seite oder ein Neuaufbau. */
    if (aussen.getElementById("ulh-nav-host")) return;

    try {
      var quelle = document.querySelector('link[rel="stylesheet"][href*="landing-hero.css"]');
      if (quelle && !aussen.querySelector('link[href="' + quelle.href + '"]')){
        var l = aussen.createElement("link");
        l.rel = "stylesheet"; l.href = quelle.href;
        aussen.head.appendChild(l);
      }
      var host = aussen.createElement("div");
      host.id = "ulh-nav-host";
      host.className = "ulh-root ulh-nav-host";
      host.appendChild(nav);
      aussen.body.appendChild(host);
      /* Verschwindet das Embed (Seitenwechsel im Baukasten), verschwindet auch die Leiste --
         sonst bliebe sie als Rest in einer Seite stehen, die sie nicht mehr kennt. */
      window.addEventListener("pagehide", function(){
        try { host.parentNode.removeChild(host); } catch (e){}
      });
    } catch (e){ /* fremde Herkunft: die Leiste bleibt, wo sie ist */ }
  }

  /* WARUM die Leiste hier NICHT nachgefuehrt wird, obwohl sie in einem Rahmen nicht klebt:
     Ich hatte sie ein Bild pro Frame nachgeschoben -- gemessen am Rahmen im Fenster darueber. Das
     funktioniert, aber es SIEHT falsch aus: jede Bewegung aus JavaScript kommt ein Bild nach dem
     Scrollen an, und genau das liest sich als Nachziehen. Eine Leiste, die der Seite hinterherlaeuft,
     ist schlechter als eine, die einfach oben stehen bleibt.
     Sticky im CSS bleibt: auf einer gewoehnlichen Seite klebt die Leiste damit sauber und ohne
     einen Takt (gemessen: nach 1200px Scrollen steht sie weiter bei 0). In einem Embed-Rahmen kann
     das niemand von innen leisten -- dort scrollt dieses Fenster nicht, und eine echte, ruckelfreie
     Leiste gehoert in den Baukasten, der die Seite baut. */

  /* Der Stand je Buchstabe, gerechnet aus der echten Lage der Ueberschrift. */
  /* Ueber welche Strecke sich der Satz vollstaendig einfaerbt, als Anteil der Fensterhoehe.
     0.28 bei 900px sind 252px -- von der Mitte bis knapp unter den oberen Rand. */
  var SATZ_LAUF = 0.28;
  function schriftTakt(h, buchstaben){
    var l = lage(h);
    /* Los geht es, wenn der Satz MITTIG steht -- vorher gar nicht.
       Vorher lief es von "Oberkante bei 92 Prozent der Fensterhoehe" bis "40 Prozent", und das
       war der Fehler: gemessen ist der Satz 157px hoch in einem 900px-Fenster, mittig steht seine
       Oberkante also bei 372px (41.3 Prozent) -- und dort war er nach der alten Rechnung schon zu
       97 Prozent eingefaerbt. Man sah also nie, wie es passiert, sondern nur das Ergebnis.
       Die Mitte wird GERECHNET und nicht als Anteil festgeschrieben: der Satz ist auf einem
       schmalen Fenster hoeher (er bricht anders um), und dann liegt seine Mitte anderswo.
       l.hoch ist seine eigene Hoehe, l.hoehe die des Fensters -- beides kommt aus lage(). */
    var mitte = (l.hoehe - l.hoch) / 2;
    var p = (mitte - l.oben) / (l.hoehe * SATZ_LAUF);
    p = p < 0 ? 0 : (p > 1 ? 1 : p);
    var n = buchstaben.length;
    for (var i = 0; i < n; i++){
      /* Die Front ist zwoelf Buchstaben breit -- etwa zwei Woerter. Ein Buchstabe nach dem anderen
         ganz oder gar nicht waere ein Flimmern; so wandert eine weiche Kante durch den Satz. */
      var t = (p * (n + 12) - i) / 12;
      t = t < 0 ? 0 : (t > 1 ? 1 : t);
      buchstaben[i].style.setProperty("--t", t.toFixed(3));
    }
  }

  function quellen(){
    return '<section class="ulh-quell">' +
      '<div class="ulh-spur">' +
        '<div class="ulh-quell-kopf">' +
          /* Derselbe blaue Chip wie ueber der Ueberschrift der Karten (.ulh-feat-chip) -- eine
             Sektion, ein Chip. Er bringt seinen Abstand nach unten selbst mit (18px). */
          '<span class="ulh-feat-chip ulh-auf">' + QUELL_CHIP + '</span>' +
          '<h2 class="ulh-quell-h">' + quellWorte() + '</h2>' +
          /* Derselbe Knopf wie im Hero (.ulh-btn .ulh-btn-sec) -- .ulh-quell-cta traegt nur noch
             den Abstand nach oben und kein zweites Aussehen. */
          '<a class="ulh-btn ulh-btn-sec ulh-quell-cta ulh-auf" href="#" role="button">' + QUELL_CTA + '</a>' +
        '</div>' +
        /* Der Kasten ist unten offen: er wird angeschnitten, und der Inhalt laeuft weiter. Genau
           das laesst ihn wie eine laufende Seite wirken und nicht wie ein Bildschirmfoto. */
        '<div class="ulh-quell-box ulh-auf ulh-auf-gross">' +
        '<div class="ulh-quell-panel">' +
          '<div class="ulh-quell-dom">' +
            '<span class="up-logo-box has-img">' +
              '<img src="' + quellzeichen(QUELL_DOMAIN) + '" alt="" referrerpolicy="no-referrer"/>' +
              /* Der Rueckfallbuchstabe ist der der Domain und nicht mehr das G aus der Zeit,
                 als hier g2.com stand. Er ist nur zu sehen, wenn das Zeichen nicht laedt. */
              '<span class="up-logo-ltr">' + QUELL_DOMAIN.charAt(0).toUpperCase() + '</span>' +
            '</span>' +
            '<span class="ulh-quell-domtxt">' +
              '<span class="ulh-quell-domname">' + QUELL_DOMAIN + '</span>' +
              '<span class="ulh-quell-domsub">Review platform &middot; cited in your market since January</span>' +
            '</span>' +
          '</div>' +
          /* --ulh-q-trichter: die Trichterfarbe aus QUELL_FARBEN, als Variable an die Wurzel der
             Sektion, weil der Trichter per CSS gefaerbt wird (landing-hero.css, .udd-fn-band) --
             so steht die Palette an EINER Stelle, auch fuer den Teil, den die CSS zeichnet. */
          '<div class="ulh-quell-app up-root" data-theme="light" data-isdark="no" data-up-keepclip' +
            ' style="--ulh-q-trichter: ' + QUELL_FARBEN.trichter + '">' +
            (MARKUP.udd || "") +
          '</div>' +
        '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ---- Die Domain-Detail-Seite fuellen ----
     Der Modus steht VOR dem ersten Zeichnen: die Komponente liest ihn beim Start aus
     window.__uddMode (domain-detail.js, modusLesen), und das ist der Weg ohne Klick und ohne
     Umweg ueber die gespeicherte Vorliebe des Besuchers. Ein Klick haette beides getan -- erst
     Citation Share zeichnen, dann umschalten, und dabei die Vorliebe des Besuchers ueberschrieben.
     "domain" ist der URL-Share-Modus (so heisst er in der Komponente). */
  /* ---- ALLE BESCHRIFTUNGEN DES MODELL-BALKENCHARTS NACH AUSSEN (24.09. angefordert) --------
     core entscheidet je Zeile neu: passt Logo, Name und Wert in den Balken, stehen sie drin,
     sonst daneben (renderBars in makeTypeChart). Bei vier Modellen heisst das zwei innen und zwei
     daneben -- eine Spalte, die in der Mitte die Seite wechselt.
     Hier wird dieselbe Entscheidung fuer alle Zeilen auf "daneben" gestellt, und zwar ueber
     genau die Griffe, die core selbst benutzt: die Deckkraft der inneren Teile auf 0, der aeussere
     Kasten an das Balkenende plus 8px. Kein Eingriff in core -- das waere eine Aenderung an der
     Hauptapp, und die ist in dieser Runde ausgeschlossen.
     NICHT MEHR NACH DER UHR, SONDERN WENN CORE PLATZIERT (28.09.). Vorher lief das hier zu vier
     festen Zeitpunkten (300 bis 2600ms nach dem Fuellen). core platziert aber auch SPAETER: am
     Ende des Wachsens (transitionend) und bei jeder Meldung seines ResizeObservers -- und beides
     kommt erst, wenn der Browser zeichnet. Wird die Seite in einem Hintergrund-Tab geladen, ist
     das lange nach 2600ms. Gemessen im Pruefstand (headless Chrome, der Kasten der Balken um 18
     Prozent schmaler gestellt, core platziert daraufhin ueber seinen ResizeObserver neu): mit der
     Uhr standen ChatGPT und Perplexity danach wieder INNEN, Google und Claude aussen -- und
     blieben es auch nach dem Zuruecksetzen der Breite. Solange die Sektion in jeder Runde des
     Hero neu gefuellt wurde, fiel das nicht auf -- das Neufuellen hat es jede Minute wieder
     geradegezogen, mit genau dem Neuzeichnen, das weg sollte.
     Jetzt zieht balkenBewachen nach, sobald core an den Zeilen schreibt. Das ist KEINE Uhr: ohne
     Schreiben von core passiert hier nichts. Und es kann nicht kreisen: geschrieben wird nur, was
     abweicht, und core hoert auf keine dieser Eigenschaften.
     Die Lage kommt aus der ZIELbreite (der Prozentwert, den core an die Fuellung schreibt) und
     nicht aus offsetWidth: mitten im Wachsen misst offsetWidth einen Zwischenstand, und die
     Beschriftung haette am falschen Ende gestanden.
     Eine Zeile, die core noch gar nicht platziert hat, bleibt unberuehrt -- erst waechst der
     Balken, dann kommt die Schrift, so wie core es vorsieht. */
  function balkenNachAussen(root){
    var zeilen = root.querySelectorAll(".udd-root .up-bar-row");
    for (var i = 0; i < zeilen.length; i++){
      var z = zeilen[i];
      var fuellung = z.querySelector(".up-bar-fill");
      var spur = z.querySelector(".up-bar-track");
      var name = z.querySelector(".up-bar-name");
      var pin = z.querySelector(".up-bar-pct-in");
      var aussen = z.querySelector(".up-bar-outside");
      if (!fuellung || !aussen) continue;
      var platziert = aussen.style.opacity === "1" ||
        (name && name.style.opacity === "1") || (pin && pin.style.opacity === "1");
      if (!platziert) continue;
      var anteil = parseFloat(fuellung.style.width);
      var px = (spur && spur.clientWidth && !isNaN(anteil)) ? spur.clientWidth * anteil / 100
                                                           : fuellung.offsetWidth;
      var links = Math.round(px + 8) + "px";
      if (name && name.style.opacity !== "0") name.style.opacity = "0";
      if (pin && pin.style.opacity !== "0") pin.style.opacity = "0";
      if (aussen.style.left !== links) aussen.style.left = links;
      if (aussen.style.opacity !== "1") aussen.style.opacity = "1";
    }
  }
  /* Beobachtet nur, was core an den Balken schreibt (style) und ob die Zeilen neu entstehen
     (childList), und nur unter der eigenen Wurzel. Einmal je Wurzel. */
  function balkenBewachen(uddWurzel){
    if (!uddWurzel || uddWurzel.__ulhBalkenWacht || !window.MutationObserver) return;
    uddWurzel.__ulhBalkenWacht = true;
    new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var ziel = muts[i].target;
        if (ziel && ziel.closest && ziel.closest(".up-bars, .udd-modelbody")){
          try { balkenNachAussen(uddWurzel); } catch (e){}
          return;
        }
      }
    }).observe(uddWurzel, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
  }

  /* ---- Die Kurvenfarben der Quellen-Sektion (QUELL_FARBEN.linien) --------------------------
     domain-detail rechnet die Farben seiner URL-Kurven selbst -- aus der Farbe des Zitationstyps
     (familie() in domain-detail.js) -- und reicht sie als color an UC.buildLineDatasets. Einen
     Weg ueber die Daten gibt es dafuer nicht, und die Komponente selbst zu aendern hiesse, die
     Hauptapp zu aendern. Also nimmt die Landingpage genau diesen einen Uebergabepunkt: sie
     legt eine Huelle um UC.buildLineDatasets, die NUR dann eingreift, wenn ALLE Reihen Seiten
     dieser Sektion sind (die fuenf Adressen aus QUELL_SEITEN). Jede andere Kurve der Seite --
     das Visibility-Chart im Hero -- geht unveraendert durch.
     WARUM VOR dem Zeichnen und nicht danach am fertigen Chart: danach umzufaerben hiesse,
     entweder die Eingangsanimation mit update("none") abzuschneiden oder erst Cyan und dann Blau
     zu zeigen. Und makeLine baut bei einem Themenwechsel aus dem GEMERKTEN Ergebnis neu
     (build(lastBuilt)) -- die Farben ueberleben so auch das, ohne dass hier jemand nachfasst.
     Die Zuordnung haengt an der Adresse und nicht an der Reihenfolge: die Komponente sortiert
     nach Gesamtanteil, QUELL_SEITEN steht in derselben Reihenfolge -- aendert sich eine der
     beiden, behaelt jede Seite trotzdem ihre Farbe. */
  function quellLinienFarben(){
    var UC = window.UpstreemCore;
    if (!UC || typeof UC.buildLineDatasets !== "function" || UC.buildLineDatasets.__ulhQuelle) return;
    var farbe = {};
    QUELL_SEITEN.forEach(function(s, i){
      farbe["https://www." + QUELL_DOMAIN + s.p] = QUELL_FARBEN.linien[i % QUELL_FARBEN.linien.length];
    });
    var vorher = UC.buildLineDatasets;
    var huelle = function(series, companies, scale){
      var unsere = Object.prototype.toString.call(companies) === "[object Array]" &&
        companies.length > 0 &&
        companies.every(function(c){ return c && farbe[c.company_id]; });
      if (unsere){
        companies = companies.map(function(c){
          var kopie = {};
          for (var k in c) kopie[k] = c[k];
          kopie.color = farbe[c.company_id];
          return kopie;
        });
      }
      return vorher.call(this, series, companies, scale);
    };
    huelle.__ulhQuelle = true;
    UC.buildLineDatasets = huelle;
  }

  /* ---- EINMAL FUELLEN, DANN STEHEN LASSEN (28.09. gemeldet, "zum 100. Mal": "Die Komponente
     refresht sich mit dem Zyklus des Hero Komponent. Das soll sie nicht machen.") -------------
     GEMESSEN und nicht vermutet, im Pruefstand mit einem MutationObserver auf .udd-root, Haken an
     Chart.js (neu/update/destroy je Chart der Komponente) und dem Aufrufstapel jedes Ausloesers:
     am Ende jeder Runde ruft neustart() fuellen(), um das Dashboard auf Zustand A zurueckzustellen,
     und fuellen() rief dabei JEDES MAL auch quellFuellen(). Darin steckten zwei Ausloeser:
       1. themaHell() -> setUpstreemTheme("light"). core ruft dabei jeden Themen-Abonnenten, auch
          wenn das Thema schon hell ist (THEME.subs ohne Vergleich). makeLine baut die Kurve
          daraufhin neu -- destroy und ein neues Chart samt Eingangsanimation --, und domain-detail
          zeichnet Ring, Trichter und Modellbalken neu.
       2. setDomainDetail mit denselben Daten -> render() baut Trichter, Ring und Balken ein zweites
          Mal, und tippSetzen() zeichnet die Kurve noch einmal nach.
     Die frueheren Anlaeufe (21.09. und 24.09.) haben am Tooltip-Waechter gedreht -- der war nur
     ein Nachlaeufer dieses Neufuellens, nicht seine Ursache.
     Die Quellen-Sektion hat mit dem Kreislauf des Hero nichts zu tun: sie wird EINMAL gefuellt und
     bleibt dann stehen. Die Marke haengt an der Wurzel der Komponente und nicht an der Datei: wird
     die Wurzel je ersetzt, wird die neue auch wieder gefuellt. Gesetzt wird sie erst, wenn beide
     Setter da sind -- fehlte domain-detail.js beim ersten Aufruf, holt die naechste Runde das
     Fuellen nach, genau wie bisher. */
  function quellFuellen(){
    var uddWurzel = document.querySelector('.udd-root[data-instance="' + ID.udd + '"]');
    if (!uddWurzel || uddWurzel.__ulhQuellGefuellt) return;
    if (!window.setDomainDetail || !window.setDomainDetailUrls) return;
    uddWurzel.__ulhQuellGefuellt = true;
    /* Erst das Thema, dann die Daten: die Charts nehmen ihre Farben beim Zeichnen, und das
       passiert im selben Zug wie das Setzen der Daten. */
    themaHell();
    var wurzel0 = document.querySelector(".ulh-root");
    if (wurzel0) hellHalten(wurzel0);
    window.__uddMode = window.__uddMode || {};
    window.__uddMode[ID.udd] = "domain";
    /* Die Farben der Kurven VOR den Daten: sie muessen im ersten Bild stimmen (siehe
       quellLinienFarben). Die Beschriftungen der Modellbalken ebenfalls vorher -- der Waechter
       sieht dann schon die ersten Zeilen entstehen. */
    quellLinienFarben();
    balkenBewachen(uddWurzel);
    if (window.setDomainDetail) window.setDomainDetail(ID.udd, JSON.stringify(quellHaupt()));
    if (window.setDomainDetailUrls) window.setDomainDetailUrls(ID.udd, JSON.stringify(quellUrls()));
    /* Der Tooltip soll STEHEN, nicht auf einen Mauszeiger warten -- auf einer Landingpage gibt es
       keinen. Chart.js kennt dafuer setActiveElements; der aeussere Tooltip aus core zeichnet sich
       daraufhin selbst. Der Zeitpunkt: erst nachdem die Komponente ihre Daten gezeichnet hat,
       deshalb ein kurzer Nachlauf und ein zweiter Versuch, falls das Chart spaeter fertig wird. */
    var versuche = 0;
    (function tipp(){
      if (tippSetzen()){ tippWachen(); return; }
      if (versuche++ < 40) setTimeout(tipp, 150);
    })();
    /* Die Beschriftungen des Modell-Charts nach aussen: das uebernimmt balkenBewachen (oben), und
       zwar jedes Mal, wenn core sie setzt -- die vier festen Nachfass-Zeitpunkte, die hier
       standen, kamen in einem Hintergrund-Tab zu frueh (siehe balkenNachAussen). */
  }

  /* Den Tooltip auf die MITTE der Reihe setzen. Zuerst stand er auf dem vorletzten Punkt, weil das
     Chart die ganze Breite hatte und der Kasten am rechten Rand herausgehangen haette. Jetzt ist
     das Chart halb so breit, und mittig ist die Stelle, an der der Kasten ganz im Bild steht. */
  function uddChart(){
    var wurzel = document.querySelector('.udd-root[data-instance="' + ID.udd + '"]');
    /* .udd-canvas und nicht .up-line-canvas: die Domain-Detail-Seite gibt ihrer Leinwand einen
       eigenen Namen. Mit dem falschen Namen fand die Schleife nie ein Chart und lief vierzig Mal
       ins Leere -- gemessen, bevor der Name stimmte. */
    var lein = wurzel && wurzel.querySelector(".udd-canvas");
    if (!lein || !window.Chart || !window.Chart.getChart) return null;
    return window.Chart.getChart(lein) || null;
  }

  function tippSetzen(){
    try {
      var chart = uddChart();
      if (!chart || !chart.data || !chart.data.datasets.length) return false;
      var i = Math.max(0, Math.floor(((chart.data.labels || []).length - 1) / 2));
      var aktive = chart.data.datasets.map(function(_, d){ return { datasetIndex: d, index: i }; });
      var pos = chart.getDatasetMeta(0).data[i];
      chart.setActiveElements(aktive);
      chart.tooltip.setActiveElements(aktive, { x: pos ? pos.x : 0, y: pos ? pos.y : 0 });
      chart.update("none");
      return true;
    } catch (e){ return false; }
  }

  /* Er soll DAUERHAFT stehen. Baut die Komponente ihr Chart neu -- Breitenwechsel, neue Daten --,
     sind die gesetzten Punkte weg und der Kasten verschwindet; einen Mauszeiger, der ihn
     zurueckholt, gibt es auf einer Landingpage nicht.
     Geprueft wird am KASTEN und nicht an den gesetzten Punkten: sichtbar oder nicht ist die Frage,
     um die es geht, und core setzt dafuer die Deckkraft des Elements direkt (core.js, externer
     Tooltip von makeLine). Eine Pruefung an chart.tooltip haette sich selbst nicht widerlegen
     koennen -- fehlt die Auskunft, sieht "nicht gesetzt" wie "verschwunden" aus, und der Waechter
     haette alle 1,5 Sekunden ein Chart neu gezeichnet, das laengst richtig stand. */
  /* DER WAECHTER HOERT AUF, SOBALD ER FERTIG IST (21.09. gemeldet: "das Domain-Detail-Ding
     updatet hier und da, laedt neu -- das soll einmal bei appear hereinladen und dann so
     bleiben").
     Er lief ohne Ende: alle 1,5 Sekunden pruefen, und solange der Kasten nicht sichtbar war,
     tippSetzen() -- und darin steckt chart.update("none"), also ein Neuzeichnen des Charts. Auf
     einer Seite ohne Mauszeiger im Fenster ist das ein Neuzeichnen alle 1,5 Sekunden, dauerhaft.
     Jetzt zwei Grenzen: drei Durchgaenge mit sichtbarem Kasten hintereinander heisst "steht", und
     nach VERSUCHE_TIPP Anlaeufen ist ohnehin Schluss -- was bis dahin nicht steht, steht auch
     nach einer Minute nicht, und ein Chart, das sich dabei jede Sekunde neu zeichnet, ist der
     schlechtere Zustand als ein Chart ohne Kasten. */
  /* NOCH EINMAL ENGER (24.09. gemeldet: "das Linechart oben links updatet sich immernoch ab und
     zu"). Die zwei Grenzen von oben haben den Dauerlauf beendet, aber nicht das Nachzeichnen:
     eine Minute lang lief die Uhr weiter, und JEDER Takt ohne sichtbaren Kasten rief tippSetzen
     -- und darin steckt chart.update("none"). Der Kasten ist aber nicht immer sichtbar: core
     blendet ihn ueber die Deckkraft, und waehrend dieser Blende misst der Waechter eine Null.
     Drei Aenderungen:
       - der Waechter laeuft nur EINMAL je Seite (__ulhTippWacht),
       - zwei ruhige Takte statt drei reichen als Beweis, dass er steht,
       - und nach 12 Anlaeufen (18s) ist Schluss statt nach 40 (60s).
     Was danach passiert, passiert ohne dieses Chart. */
  var VERSUCHE_TIPP = 12;          /* 12 x 1,5s = 18 Sekunden */
  var TIPP_RUHIG = 2;              /* so oft hintereinander sichtbar = fertig */
  function tippWachen(){
    if (window.__ulhTippWacht) return;
    window.__ulhTippWacht = true;
    var n = 0, steht = 0;
    var uhr = setInterval(function(){
      var wurzel = document.querySelector('.udd-root[data-instance="' + ID.udd + '"]');
      if (!wurzel){ clearInterval(uhr); return; }
      var tt = wurzel.querySelector(".up-line-tt");
      var sichtbar = !!(tt && tt.style.opacity && tt.style.opacity !== "0");
      if (sichtbar){
        if (++steht >= TIPP_RUHIG){ clearInterval(uhr); return; }
      } else {
        steht = 0;
        tippSetzen();
      }
      if (++n > VERSUCHE_TIPP) clearInterval(uhr);
    }, 1500);
  }

  /* ---- Die Daten der Beispiel-Domain ----
     Sieben Tage, fuenf Seiten. Gerechnet und nicht gewuerfelt: bei jedem Laden dasselbe Bild, und
     die Zahlen haengen zusammen -- der Tagesanteil schwankt um den Grundwert der Seite, und die
     Summe der fuenf bleibt unter dem Domainanteil. */
  var QUELL_TAGE = ["2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15",
                    "2026-08-16", "2026-08-17", "2026-08-18"];
  /* Fuenf Seiten dieser Domain. Die Pfade sind SO GEBAUT, wie ein Testmagazin sie baut, und die
     Titel nennen die Kategorie und das Jahr -- aber keine der fuenf behauptet ein Testergebnis
     fuer einen echten Hersteller. Was sie zeigen, ist der Anteil, den die SEITE an Acmes
     Antworten hat, und das ist eine Aussage ueber Acme. */
  /* KURZ GENUG FUER DEN TOOLTIP (21.09. nachgezogen: "mach ein paar der Namen kuerzer, dass sie
     nicht truncaten muessen"). Der Kasten ist auf 420px gedeckelt, davon gehen 14px Zeichen,
     8px Abstand, 64px bis zur Zahl und 24px Polster ab -- es bleiben rund 300px fuer den Titel,
     und das sind bei 13px Schrift etwa 46 Zeichen. Die fuenf hier liegen alle darunter; die
     Ellipse bleibt als Netz fuer den Fall, dass jemand laengere einsetzt. */
  var QUELL_SEITEN = [
    { p: "/safest-family-road-trip-vehicles", t: "The 18 Safest Family Road-Trip Vehicles", b: 6.2 },
    { p: "/best-fuel-economy-2026",           t: "Best Fuel Economy For 2026, Says The EPA", b: 4.4 },
    { p: "/best-luxury-electric-suv-2026",    t: "The Best Luxury Electric SUVs Of 2026", b: 3.1 },
    { p: "/ev-winter-range-guide",            t: "How Much Range An EV Loses In Winter", b: 2.3 },
    { p: "/top-safety-pick-2027",             t: "Who Keeps The IIHS Top Safety Pick+", b: 1.6 }
  ];

  function quellHaupt(){
    return {
      header: {
        id: QUELL_DOMAIN, domain: QUELL_DOMAIN, favicon: quellzeichen(QUELL_DOMAIN),
        first_seen: "2026-01-14", last_seen: "2026-08-18", citation_type: "UGC_Community",
        current_citation_share: 17.6, citation_share_delta_pct: 2.4, citation_share_prev: 15.2,
        total_citations_count: 1284, total_citations_prev: 1043, total_citations_delta_pct: 23.1
      },
      timeseries: {
        citation_share_over_time: QUELL_TAGE.map(function(t, i){
          /* Eine Kurve, die steigt und dabei atmet: der Grundwert waechst, der Zackenanteil
             wechselt das Vorzeichen. Kein Zufall -- sonst sieht die Seite bei jedem Laden anders
             aus als auf dem letzten Bildschirmfoto. */
          return { day: t, share_pct: Math.round((14.8 + i * 0.55 + (i % 2 ? 0.9 : -0.7)) * 100) / 100 };
        })
      },
      /* Die Schluessel muessen aus URL_TYPE in core.js kommen -- ein Typ, den die Tabelle nicht
         kennt, bekommt keine Farbe und wird grau ("Other"). Genau das war hier zu sehen: "product"
         heisst dort product_service, und "uncategorized" gibt es gar nicht.
         Die Verteilung passt zu dem, was ein Testmagazin wirklich ist: Bestenlisten (Listicle),
         Einzeltests (Review), Vergleiche (Comparison), Modelluebersichten (Directory) und
         Ratgeber (Guide). */
      types_breakdown: [
        { type: "listicle", share_pct: 31.5 },
        { type: "review", share_pct: 27.8 },
        { type: "comparison", share_pct: 18.6 },
        { type: "directory", share_pct: 14.9 },
        { type: "guide", share_pct: 7.2 }
      ],
      /* Die Balkenfarben kommen aus QUELL_FARBEN.modelle (28.09.) und nicht mehr aus den
         Markenfarben der Modelle -- Begruendung dort. color_darkmode traegt dieselbe Stufe: die
         Sektion ist immer hell (data-theme="light" an .ulh-quell-app), der Wert wird nie
         gezeichnet, und eine zweite Reihe dafuer waere eine erfundene. */
      model_breakdown: [
        { model: "ChatGPT", model_share_pct: 38.2,
          color_lightmode: QUELL_FARBEN.modelle[0], color_darkmode: QUELL_FARBEN.modelle[0],
          model_logo_url: quellzeichen("openai.com") },
        { model: "Perplexity", model_share_pct: 27.4,
          color_lightmode: QUELL_FARBEN.modelle[1], color_darkmode: QUELL_FARBEN.modelle[1],
          model_logo_url: quellzeichen("perplexity.ai") },
        { model: "Google AI Overviews", model_share_pct: 21.9,
          color_lightmode: QUELL_FARBEN.modelle[2], color_darkmode: QUELL_FARBEN.modelle[2],
          model_logo_url: quellzeichen("google.com") },
        { model: "Claude", model_share_pct: 12.5,
          color_lightmode: QUELL_FARBEN.modelle[3], color_darkmode: QUELL_FARBEN.modelle[3],
          model_logo_url: quellzeichen("claude.ai") }
      ],
      source_presence_funnel: {
        ai_searches_citing_domain: 1284, cited_urls_count: 216,
        urls_with_tracked_brands: 148, tracked_brand_presence_pct: 68.5,
        urls_mentioning_you: 41, your_url_presence_pct: 19.0,
        urls_mentioning_competitors: 107, urls_without_tracked_brands: 68
      }
    };
  }

  function quellUrls(){
    var punkte = [];
    QUELL_TAGE.forEach(function(tag, i){
      QUELL_SEITEN.forEach(function(sei, j){
        /* Dieselbe Machart wie oben: Grundwert der Seite plus ein Ausschlag, der mit Tag und Seite
           wechselt. Die Summen (share_total_pct und die zwei Anteile) sind aus dem Grundwert
           gerechnet, damit Legende und Kurve dieselbe Reihenfolge zeigen. */
        var aus = ((i + j) % 3 - 1) * 0.45;
        punkte.push({
          day: tag, url: "https://www." + QUELL_DOMAIN + sei.p, title: sei.t,
          share_pct: Math.round((sei.b + aus) * 100) / 100,
          url_runs_total: Math.round(sei.b * 21),
          share_total_pct: sei.b,
          domain_share_total_pct: Math.round((sei.b / 17.6) * 1000) / 10,
          global_share_total_pct: sei.b
        });
      });
    });
    return { to: QUELL_TAGE[QUELL_TAGE.length - 1], from: QUELL_TAGE[0], top_n: 5,
             domain: QUELL_DOMAIN, share_mode: "domain", points: punkte };
  }

  /* Der Fensterrahmen, dreimal derselbe. Die drei Punkte sind bei einem echten Fenster in jeder
     Groesse gleich gross -- ein kleines Fenster hat keinen kleineren Rahmen --, also stehen sie
     hier als EIN Bauteil und nicht je Fenster neu. */
  /* WARUM data-up-keepclip an jedem Schirm und jedem Inhaltskasten der Nebenfenster: core
     entklammert beim Mount jeder Komponente die ganze Vorfahrenkette (unclipAncestors) und
     schreibt overflow: visible als INLINE-Stil. Ohne die Marke lief die Kette von den Komponenten
     in den Nebenfenstern bis zur Wurzel der Sektion durch -- gemessen: die Wurzel trug danach
     inline "overflow: visible", und damit war auch das overflow-x: clip weg, das die Nebenfenster
     am Rand der Sektion abschneidet UND die waagerechte Scrollleiste der Seite verhindert
     (Dokumentbreite 1546 bei 1440 Fensterbreite). Derselbe Grund wie am Hauptfenster, nur eine
     Ebene tiefer. */
  function chrom(){
    return '<div class="ulh-chrome" aria-hidden="true">' +
      '<span class="ulh-dot"></span><span class="ulh-dot"></span><span class="ulh-dot"></span>' +
    '</div>';
  }

  /* ---------- Erstes Nebenfenster: das Team-Dropdown -------------------------------------
     Das Panel ist das ECHTE aus der Seitenleiste: dieselben Klassen, dieselben Regeln
     (sidebar.css fuer .usn-teamlist/.usn-teamrow, core.css fuer .up-pop-opt, .up-ddsearch,
     .up-logo-box, .up-check). Nachgebaut ist nichts -- sidebar.js baut dieses Markup in
     renderTeamMenu, und die Zeilen hier sind Zeile fuer Zeile dieselben. Was fehlt, ist der
     Fussknopf "Create a new team": im Schaustueck kann niemand ein Team anlegen, und ein Knopf,
     der nichts tut, ist ein Versprechen.
     Der Panel-RAHMEN faellt weg (Schatten, eigener Rand, position: absolute aus .up-filter-menu,
     siehe landing-hero.css) -- hier ist das Fenster der Rahmen.

     Die Teams sind DIESELBEN acht, die die Leiste im Hauptfenster kennt (fuellen, setSidebarTeams).
     Eine zweite Teamliste in derselben Sektion waere der Bruch, den man zuerst sieht. */
  /* DIE TEAMS SIND ECHTE MARKEN AUS ANDEREN BRANCHEN (21.09., zweite Runde).
     Zuerst standen hier die Automarken -- falscher Gegenstand: der Umschalter zeigt die
     ARBEITSBEREICHE eines Nutzers, und das sind andere Firmen, nicht die Wettbewerber der einen.
     Dann standen hier erfundene Namen mit Buchstabenkaestchen, und das war zu blass: neben einer
     Zeile mit echtem Logo sieht ein graues "N" nach fehlenden Daten aus.
     Jetzt echte Marken mit ihren echten Zeichen, quer durch die Branchen -- Luftfahrt,
     Unterhaltung, Industrie, Versicherung, Handel, Logistik, Sport. Keine davon ist eine
     Automarke: der Umschalter soll gerade NICHT nach Acmes Wettbewerbsfeld aussehen.
     Zahlen behauptet diese Liste keine -- sie sagt nur, dass es mehrere Arbeitsbereiche gibt. */
  var TEAMS = [
    { name: "Acme",      dom: "acme.com" },        /* das eigene, bleibt oben */
    { name: "Lufthansa", dom: "lufthansa.com" },
    { name: "Sony",      dom: "sony.com" },
    { name: "Siemens",   dom: "siemens.com" },
    { name: "Allianz",   dom: "allianz.com" },
    { name: "Zalando",   dom: "zalando.de" },
    { name: "DHL",       dom: "dhl.com" },
    { name: "adidas",    dom: "adidas.com" }
  ];
  /* Acme traegt ihr eigenes Zeichen, alle anderen ihr echtes. */
  TEAMS.forEach(function(t){ t.logo = (t.dom === "acme.com") ? ACME_LOGO : quellzeichen(t.dom); });

  var FEN_TEAM_AKTIV = 0;          /* Acme -- der ausgewaehlte Bereich, bleibt oben stehen */
  /* BEIDE unteren Zeilen wechseln (21.09. angefordert: "da soll auch die untere durchrotieren").
     Vorher stand die dritte fest, weil der Chip zu IHREM Team gehoert -- der Chip wandert jetzt
     einfach mit, und genau das ist die Aussage: nicht "dieses eine Team hat einen Pitch", sondern
     "jedes Team kann einen haben".
     Zwei GETRENNTE Toepfe, damit nie dieselbe Firma zweimal untereinander steht. */
  var FEN_TEAM_WECHSEL  = [1, 2, 3];      /* Northaven, Verde, Halcyon */
  var FEN_TEAM_WECHSEL2 = [4, 5, 6, 7];   /* Northsign, Perla, Orbit, Tessera */
  var FEN_TEAM_MS = 5000;
  /* Der Wechsel selbst: die Zeile geht weg, wird ausgetauscht, kommt zurueck. Zwei Haelften einer
     Bewegung, deshalb zwei Zahlen; die CSS traegt den Uebergang (landing-hero.css). */
  var FEN_TEAM_AUS = 260, FEN_TEAM_AN = 300;

  function teamDomain(m){ return m.dom; }

  /* DER PITCH-CHIP GEHOERT NICHT AN JEDE ZEILE (21.09. angefordert: "mach Pitch nur bei adidas
     und Sony dran"). Vorher trug ihn die untere Zeile immer -- und damit sagte er nichts mehr:
     eine Auszeichnung, die jeder hat, ist keine. Jetzt haengt er an zwei bestimmten
     Arbeitsbereichen und wandert mit ihnen durch die Rotation. */
  var TEAM_CHIP = { "adidas.com": "Pitch", "sony.com": "Pitch" };
  /* Beide Wechselzeilen fragen hier nach -- Sony steht im oberen Topf, adidas im unteren, und
     der Chip soll an der MARKE haengen und nicht an der Zeile. Vorher trug nur die untere Zeile
     ueberhaupt einen, und Sony haette ihn nie bekommen. */
  function chipFuer(i){
    var t = TEAMS[i % TEAMS.length];
    return (t && TEAM_CHIP[t.dom]) || null;
  }

  /* Eine Zeile des Panels. logo/name/domain wie in der Leiste, der Haken rechts kommt mit und ist
     nur in der aktiven Zeile zu sehen (core.css: .up-pop-opt.is-active .up-check). */
  /* DIE ROLLE WIRD MITGEGEBEN und nicht aus dem Chip erraten (24.09. gemeldet: "es kommt vor,
     dass Zeile 2 und 3 beide dieselbe Firma zeigen").
     Genau daran lag es: die Marke data-team-row hiess "fest", sobald eine Zeile einen Chip trug.
     Sony steht im OBEREN Topf und traegt einen -- kam Sony in Zeile 2, hiess sie ab da "fest",
     es gab zwei "fest"-Zeilen und keine "wechsel". Der naechste Tausch fand fuer "wechsel"
     nichts mehr und schrieb stattdessen ZWEIMAL aus dem unteren Topf: erst in Zeile 2, dann in
     Zeile 3 -- und aus einem Topf von vier koennen dabei zweimal dieselbe Firma kommen.
     Die zwei Toepfe sind ueberschneidungsfrei; mit fester Rolle kann es dazu nicht mehr kommen. */
  function teamZeile(i, aktiv, chip, rolle){
    var m = TEAMS[i % TEAMS.length];
    return '<div class="up-pop-opt usn-teamrow' + (aktiv ? " is-active" : "") + '" data-team-row="' +
        (rolle || (aktiv ? "aktiv" : "wechsel")) + '">' +
      '<span class="up-logo-box has-img"><img src="' + m.logo + '" alt=""/>' +
        '<span class="up-logo-ltr">' + m.name.charAt(0) + '</span></span>' +
      '<span class="usn-teamrow-txt">' +
        '<span class="usn-teamrow-name">' + m.name + '</span>' +
        '<span class="usn-teamrow-dom">' + teamDomain(m) + '</span>' +
      '</span>' +
      (chip ? '<span class="ulh-teamchip">' + chip + '</span>' : "") +
      '<span class="up-check" data-ic="check" data-ic-w="2.4"></span>' +
    '</div>';
  }

  function fensterTeams(){
    return '<div class="ulh-fen ulh-fen-teams">' + chrom() +
      '<div class="ulh-fen-view" data-up-keepclip>' +
        '<div class="ulh-fen-app up-root" data-up-keepclip data-theme="light" data-isdark="no">' +
          '<div class="up-filter-menu usn-menu is-team is-shown ulh-teampanel">' +
            '<div class="up-ddsearch usn-ddsearch">' +
              '<span class="up-ddsearch-ic" data-ic="search" data-ic-w="2"></span>' +
              '<input class="up-ddsearch-in" type="text" placeholder="Search teams" readonly tabindex="-1"/>' +
            '</div>' +
            '<div class="usn-teamlist">' +
              teamZeile(FEN_TEAM_AKTIV, true, null, "aktiv") +
              teamZeile(FEN_TEAM_WECHSEL[0], false, chipFuer(FEN_TEAM_WECHSEL[0]), "wechsel") +
              teamZeile(FEN_TEAM_WECHSEL2[0], false, chipFuer(FEN_TEAM_WECHSEL2[0]), "fest") +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* Der Wechsel der mittleren Zeile, alle fuenf Sekunden. Kein Neuaufbau des Panels: nur DIESE
     Zeile wird ersetzt, damit die zwei anderen nicht mitblinken. */
  function teamsLaufen(root){
    if (root.__ulhTeamsAn) return;
    root.__ulhTeamsAn = true;
    var k = 0, k2 = 0;
    /* EINE Funktion fuer beide Zeilen. Vorher gab es sie nur fuer die mittlere, und die dritte
       stand fest -- ein zweiter, fast gleicher Block waere die Stelle, an der die beiden beim
       naechsten Mal auseinanderlaufen. */
    function tauschen(art, index, chip){
      var zeile = root.querySelector('.ulh-fen-teams [data-team-row="' + art + '"]');
      if (!zeile) return;
      zeile.classList.add("is-tausch");
      setTimeout(function(){
        var huelle = document.createElement("div");
        huelle.innerHTML = teamZeile(index, false, chip, art);   /* die Rolle bleibt die der Zeile */
        var frisch = huelle.firstChild;
        frisch.classList.add("is-tausch");
        if (zeile.parentNode) zeile.parentNode.replaceChild(frisch, zeile);
        /* Ein Bild warten, bevor die Klasse faellt: ohne das steht das neue Element von Anfang an
           im Endzustand und kommt ohne Bewegung. */
        setTimeout(function(){ frisch.classList.remove("is-tausch"); }, 30);
        zeichenSetzen(root);
      }, FEN_TEAM_AUS);
    }
    /* KEIN eigenes Intervall mehr -- der Taktgeber unten ruft diesen Schritt (21.09.
       angefordert: "nicht alles in voellig unterschiedlichen Updatezyklen"). */
    root.__ulhSchrittTeams = function(){
      k  = (k  + 1) % FEN_TEAM_WECHSEL.length;
      k2 = (k2 + 1) % FEN_TEAM_WECHSEL2.length;
      tauschen("wechsel", FEN_TEAM_WECHSEL[k], chipFuer(FEN_TEAM_WECHSEL[k]));
      /* Die zweite Zeile ein Stueck versetzt: zwei Zeilen, die im selben Bild umschlagen, lesen
         sich als ein Neuaufbau des Panels statt als zwei einzelne Wechsel. */
      setTimeout(function(){ tauschen("fest", FEN_TEAM_WECHSEL2[k2], chipFuer(FEN_TEAM_WECHSEL2[k2])); }, 900);
    };
  }

  /* ---------- Zweites Nebenfenster: die URL-Typen im Dunkeln -----------------------------
     Der Doughnut ist UC.makeTypeChart aus core -- dasselbe Bauteil, das im Zitatteil des
     Dashboards steht, nur im Modus "url". Die Farben und die Beschriftungen kommen aus
     UC.prepTypeData (URL_COLOR_DARK, URL_LABEL): erfundene Farben waeren hier eine zweite
     Wahrheit, denn dieselben Typen haben in der App feste Toene.
     Nachkommastellen 0, wie fuer jeden Doughnut im Zitatteil (CLAUDE.md 2b). */
  /* ZWEI Verteilungen, und sie erzaehlen dieselbe Geschichte aus zwei Blickwinkeln: einmal eine
     Marke, deren Zitate aus redaktionellen Seiten kommen (Artikel, Ratgeber, Listen), einmal eine,
     die vor allem ueber Marktplaetze und ihre eigenen Produktseiten zitiert wird. So sieht man an
     einem Fenster, dass die Verteilung eine AUSSAGE ist und nicht Dekoration.
     Sieben benannte Typen und der graue Rest -- acht Punkte, die in drei Reihen zu 3/3/2 umbrechen.
     Vorher waren es neun und die letzte Reihe war voll; jetzt steht sie fuer sich.
     Der Rest ist die SUMME der uebrigen Typen und keine erfundene Zahl: beide Spalten ergeben 100. */
  /* DREI VERTEILUNGEN, und jede steht fuer eine ANDERE ART VON QUELLE (24.09. angefordert:
     "eines was eher zu einer Editorial passt, eines was eher zu einer Competitor / Corporate
     page passt und eines was eher eine UGC Seite ist"). Vorher waren es zwei, und beide sahen
     redaktionell aus -- der Wechsel zeigte dann nur andere Zahlen, nicht eine andere Welt.
     Jede Verteilung traegt SIEBEN benannte Typen plus den Rest, und alle Beschriftungen sind
     etwa gleich lang: die Legende bricht damit in allen drei Zustaenden in 3/3/2 um, also
     dieselbe Hoehe -- gemessen 268x48 bei acht Punkten. Waere eine laenger (der Satz hat mit
     "Product / Service" einen 114px-Fall), braeuchte sie vier Reihen, die Legende wuerde hoeher
     und der Ring darueber kleiner. Genau das soll beim Wechsel nicht passieren.
     Der Rest ist die SUMME der uebrigen Typen und keine erfundene Zahl: jede Spalte ergibt 100. */
  var FEN_URL_STAND = [
    /* 1. REDAKTION: Artikel, Ratgeber und Bestenlisten tragen die Antworten -- so sieht der Mix
       aus, wenn die Modelle aus Magazinen und Fachportalen zitieren. */
    { zitate: 71400, rest: 14.0, typen: [
      { type: "article",       share_pct: 22.8 },
      { type: "guide",         share_pct: 16.4 },
      { type: "listicle",      share_pct: 12.1 },
      { type: "comparison",    share_pct: 10.7 },
      { type: "forum",         share_pct: 9.3 },
      { type: "review",        share_pct: 8.2 },
      { type: "documentation", share_pct: 6.5 }
    ]},
    /* 2. DIE SEITE EINES WETTBEWERBERS: Startseite, Unternehmensangaben und Dokumentation vorn.
       Das ist das Bild, wenn ein Hersteller vor allem ueber sein EIGENES Angebot zitiert wird --
       und der Grund, warum eine Marke ihre eigenen Seiten im Blick haben muss. */
    { zitate: 48200, rest: 10.6, typen: [
      { type: "homepage",     share_pct: 24.3 },
      { type: "company_info", share_pct: 18.1 },
      { type: "directory",    share_pct: 14.6 },
      { type: "guide",        share_pct: 11.4 },
      { type: "article",      share_pct: 8.7 },
      { type: "review",       share_pct: 7.2 },
      { type: "forum",        share_pct: 5.1 }
    ]},
    /* 3. NUTZERINHALTE: Foren und soziale Beitraege vorn, dazu Video und Erfahrungsberichte --
       LinkedIn, Facebook, Reddit und YouTube. Der Mix, bei dem nicht die Redaktion entscheidet,
       was ueber eine Marke gesagt wird, sondern ihre Kundschaft. */
    { zitate: 63500, rest: 6.9, typen: [
      { type: "forum",       share_pct: 27.5 },
      { type: "social_post", share_pct: 21.2 },
      { type: "video",       share_pct: 13.8 },
      { type: "review",      share_pct: 10.9 },
      { type: "listicle",    share_pct: 8.4 },
      { type: "article",     share_pct: 6.6 },
      { type: "guide",       share_pct: 4.7 }
    ]}
  ];
  var FEN_URL_MS = 7000;
  /* Das Ausblenden vor dem Wechsel und das Einblenden danach. Der Ring zeichnet sich beim
     Einblenden selbst neu (core: 200ms Eingangsanimation des Doughnuts), also faellt beides
     zusammen und liest sich als eine Bewegung. */
  var FEN_URL_AUS = 260, FEN_URL_AN = 320;
  var fenUrlIndex = 0;

  /* core nennt die zusammengefasste Scheibe "Other" und faerbt sie grau. Als ausdruecklich
     mitgegebener Typ heisst dieselbe Scheibe "Uncategorized" (URL_LABEL) -- gleiche Farbe,
     anderer Name. Hier ist es der REST einer Verteilung und nicht ein Typ fuer sich, also gilt
     der erste Name. Die Farbe bleibt die von core (beide Wege ergeben #a0a0a0 im Dunkeln). */
  function urlScheiben(kern, stand){
    /* Die sieben benannten Typen laufen durch prepTypeData -- Reihenfolge (absteigend), Farben und
       Beschriftungen kommen damit vollstaendig aus core.
       Der graue Rest wird DANACH angehaengt und nicht mitgegeben: prepTypeData sortiert nach
       Anteil, und mit 14 Prozent stand der Rest damit an dritter Stelle mitten in der Legende.
       Er gehoert ans Ende, so wie ihn core selbst setzt, wenn ER die Scheiben zusammenfasst.
       Farbe aus demselben Weg (ein Aufruf mit genau diesem Typ), Name wie im Fall der
       Zusammenfassung: "Other" und nicht "Uncategorized" -- hier ist es der Rest einer Verteilung
       und kein Typ fuer sich. */
    var d = kern.prepTypeData("url", stand.typen, true);
    var rest = kern.prepTypeData("url", [{ type: "other", share_pct: stand.rest }], true)[0];
    rest.name = "Other";
    d.push(rest);
    return d;
  }

  function fensterUrls(){
    return '<div class="ulh-fen ulh-fen-urls is-vorn" data-ulh-dunkel>' + chrom() +
      '<div class="ulh-fen-view" data-up-keepclip>' +
        '<div class="ulh-fen-app up-root" data-up-keepclip>' +
          /* Nur die Beschriftung, kein Zaehler daneben: die Zahl der Zitate steht schon in der
             Mitte des Rings (71.4k Citations), und zweimal dieselbe Zahl in einem 360px-Fenster
             liest sich als zwei verschiedene Angaben. */
          '<div class="up-head">' +
            '<div class="up-heading"><span class="up-head-label">URL Types</span></div>' +
          '</div>' +
          '<div class="ulh-fen-donut" data-ulh-donut></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* fuellen() kennt die Wurzel nicht (es ruft nur Setter mit Kennungen). Der Doughnut haengt aber
     an einem Element im Fenster, also wird er ueber die eine Wurzel der Seite gesucht. Mehrere
     Sektionen auf einer Seite gibt es nicht -- start() baut jede fuer sich, und dieser Weg fuehrt
     zu derselben. */
  function donutFuellenSpaeter(){
    var wurzel = document.querySelector(".ulh-root");
    if (wurzel) donutFuellen(wurzel);
  }

  function donutFuellen(root){
    var kern = window.UpstreemCore;
    var koerper = root.querySelector("[data-ulh-donut]");
    if (!kern || !kern.makeTypeChart || !koerper || koerper.__ulhDonut) return false;
    var werk = kern.makeTypeChart({
      body: koerper,
      isDark: function(){ return true; },
      mode: function(){ return "url"; },
      total: function(){ return FEN_URL_STAND[fenUrlIndex].zitate; },
      centerLabel: "Citations",
      decimals: 0,
      /* Der Ring steht in einem 300px-Fenster: die Legende gehoert UNTER ihn, und genau das macht
         is-collapsed. Die Schwelle liegt darum ueber der Fensterbreite und nicht bei den 420 aus
         core -- gemessen wird mit getBoundingClientRect, also in der VERKLEINERTEN Groesse. */
      collapseAt: 9999,
      /* OHNE Verzoegerung beim Nachmessen (29.09. spaet gemeldet, mit Bild: "eine Version des URL
         Type Charts ist manchmal kaputt" -- der Ring halb so gross in der Ecke links oben, die
         Zahl in der Mitte richtig). Das Fenster steht in der verkleinerten Buehne: Chart.js misst
         beim Anlegen die sichtbare Groesse (91px), sein Beobachter gleich danach die im Layout
         (196px). Mit den 120ms aus core zeichnete es dazwischen die alte Geometrie in die neue
         Leinwand und blieb dort stehen, wenn die Nachrechnung auf das Ende der Eingangsanimation
         fiel -- darum "manchmal" und darum "eine Version". Begruendung und Messung in core
         (makeTypeChart, resizeDelay). */
      resizeDelay: 0
    });
    koerper.__ulhDonut = werk;
    werk.renderDonut(urlScheiben(kern, FEN_URL_STAND[fenUrlIndex]));
    return true;
  }

  /* Der Wechsel der Verteilung, alle sieben Sekunden und im Kreis: raus, neu zeichnen, rein.
     Nicht die Datensaetze des Charts von Hand umschreiben -- dann waeren die Hoverfarben die der
     alten Scheiben (core rechnet sie beim Zeichnen aus brighten/darken, und die zwei Funktionen
     gibt es nur dort). renderDonut baut Legende UND Ring richtig neu; das Ueberblenden darum
     macht daraus eine Bewegung statt eines Sprungs. */
  var FEN_URL_RING = 260;        /* 200ms Eingangsanimation des Rings plus Zugabe */
  var FEN_URL_RING_MAX = 1200;   /* Notbremse: danach wird aufgeblendet, egal was die Leinwand sagt */
  function ringWartenDann(koerper, fertig){
    var t0 = Date.now(), letzte = -1, gleich = 0;
    (function takt(){
      var cv = koerper.querySelector("canvas");
      var b = cv ? Math.round(cv.getBoundingClientRect().width) : 0;
      if (b > 0 && b === letzte) gleich++; else gleich = 0;
      letzte = b;
      var alt = Date.now() - t0;
      if ((gleich >= 3 && alt >= FEN_URL_RING) || alt >= FEN_URL_RING_MAX){ fertig(); return; }
      setTimeout(takt, 40);
    })();
  }

  function donutLaufen(root){
    if (root.__ulhDonutAn) return;
    root.__ulhDonutAn = true;
    root.__ulhSchrittDonut = function(){
      var kern = window.UpstreemCore;
      var koerper = root.querySelector("[data-ulh-donut]");
      if (!kern || !koerper || !koerper.__ulhDonut) return;
      koerper.classList.add("is-wechsel");
      setTimeout(function(){
        fenUrlIndex = (fenUrlIndex + 1) % FEN_URL_STAND.length;
        koerper.__ulhDonut.renderDonut(urlScheiben(kern, FEN_URL_STAND[fenUrlIndex]));
        /* Der Kopf des Fensters nennt keine Zahl (die steht in der Mitte des Rings), es gibt hier
           also nichts weiter nachzuziehen. */
        /* ERST AUFBLENDEN, WENN DER NEUE RING WIRKLICH STEHT (24.09. gemeldet: "es ist kurz ganz
           klein etwas weiter links oben, bevor es gross wird -- das Chart darf sich in den
           Abmessungen nie auch nur 1ms veraendern").
           Genau das beschreibt den Aufbau eines frisch gezeichneten Doughnuts: der Ring waechst
           aus der Mitte (200ms Eingangsanimation im Kit), und die Leinwand bekommt ihr Mass erst,
           wenn Chart.js sie gemessen hat (resizeDelay 120 plus der Beobachter am Kasten). Beides
           lief bisher SICHTBAR ab, weil die Unschaerfe im selben Augenblick wegging.
           Jetzt bleibt sie liegen, bis zwei Dinge zutreffen: die Leinwand hat dreimal
           hintereinander dasselbe Mass, und seit dem Zeichnen ist mindestens RING_MS vergangen.
           Die Notbremse sorgt dafuer, dass das Fenster nie unscharf stehen bleibt. */
        ringWartenDann(koerper, function(){ koerper.classList.remove("is-wechsel"); });
      }, FEN_URL_AUS);
    };
  }

  /* ---------- Drittes Nebenfenster: eine Antwortkarte ------------------------------------
     Die echte Responses-Tabelle im Kartenmodus (data-default-view="cards" setzt
     .landing_markup.py). Von der Komponente bleibt nur die KARTE zu sehen -- Kopf, Werkzeugleiste
     und Seitenzaehler sind im Fenster ausgeblendet (landing-hero.css): in ein 4:3-Fenster gehoert
     die Karte und nicht die halbe Seite um sie herum. */
  function fensterAntwort(){
    /* WIEDER is-vorn (29.09. spaet angefordert: "das Response-Detail-Fenster ueber dem
       Hauptfenster platzieren, nicht dahinter"). Vom 28.09. bis hierher lag sie dahinter, auch das
       war so angefordert. Solange sie mit 4px Luft daneben steht, ist die Ebene gleichgueltig; seit
       einpassen() sie ueber die Kante ruecken kann, entscheidet sie, ob die Karte oder das
       Hauptfenster abgedeckt wird -- jetzt deckt die Karte, wie die URL-Typen links. */
    return '<div class="ulh-fen ulh-fen-antwort is-vorn">' + chrom() +
      '<div class="ulh-fen-view" data-up-keepclip>' +
        '<div class="ulh-fen-app" data-up-keepclip>' + (MARKUP.urt || "") + '</div>' +
      '</div>' +
    '</div>';
  }

  /* Drei Antworten im Wechsel statt einer. Sie zeigen dasselbe in drei Modellen -- das ist der
     Punkt der App, und mit einer einzigen Karte behauptet die Sektion ihn nur.
     Die Auszuege sind so geschrieben, wie die Modelle wirklich klingen: ChatGPT ausfuehrlich,
     die Google-Uebersicht knapp und aufzaehlend, Claude abwaegend und in ganzen Saetzen. */
  var ANTWORTEN = [
    { modell: "chatgpt", sent: 82, rang: 1,
      frage: "Which premium electric SUV should I buy in 2026?",
      text: "For a premium electric SUV in 2026, the **Acme** is the strongest all-rounder right " +
        "now: it holds its stated range in independent winter tests, charges at the top of its " +
        "class, and has the quietest cabin of the three. BMW and Audi are close behind on ride" },
    { modell: "google", sent: 74, rang: 2,
      frage: "best luxury electric SUV long range",
      text: "Luxury electric SUVs are compared mainly on real world range, charging speed and " +
        "interior quality. Commonly cited options include BMW, **Acme** and Audi. Acme is noted " +
        "for its winter range, BMW for its drivetrain" },
    { modell: "claude", sent: 79, rang: 1,
      frage: "how do I choose between an electric estate and an SUV?",
      text: "It comes down to how you actually drive. An estate is the more efficient shape and " +
        "the easier one to park; the **Acme** estate gives up very little range to its own SUV, " +
        "which is usually what decides it for people doing long motorway runs" }
  ];
  var ANTWORT_HALT = 5200;      /* wie lange eine Karte steht */
  var ANTWORT_BLENDE = 420;     /* Aus- und Einblenden, jeweils */

  function antwortFuellen(k){
    if (!window.renderResponsesTable) return false;
    var a = ANTWORTEN[(k || 0) % ANTWORTEN.length];
    /* Die Modelle zuerst: der Chip auf der Karte holt Name und Zeichen aus dieser Liste, und ohne
       sie stuende dort der rohe Schluessel. Die Zeichen sind die echten der Anbieter (siehe
       quellzeichen) -- ein graues C waere hier dasselbe Raten wie bei den Quellen. */
    if (window.setResponsesTableModels) window.setResponsesTableModels(ID.urt, [
      { key: "chatgpt", display_name: "ChatGPT", logo_url: quellzeichen("openai.com") },
      { key: "google", display_name: "Google AI Overviews", logo_url: quellzeichen("google.com") },
      { key: "claude", display_name: "Claude", logo_url: claudezeichen() }
    ]);
    if (window.setResponsesTableBrand) window.setResponsesTableBrand(ID.urt, "Acme", MARKEN[0].logo);
    var vorhin = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    window.renderResponsesTable({
      instanceId: ID.urt,
      totalCount: 1,
      rows: [{
        prompt_run_id: "lh-r" + ((k || 0) + 1),
        prompt_text: a.frage,
        /* Der Auszug nennt genau die drei Marken, die unten als Chips stehen -- eine Karte, deren
           Text von anderen Marken spricht als ihre Chips, ist der Widerspruch, den man zuerst
           sieht. */
        response_preview: a.text,
        model: a.modell,
        run_at: vorhin,
        user_sentiment: a.sent,
        user_rank: a.rang,
        has_user_brand: "yes",
        companies_preview: MARKEN.slice(0, 3).map(function(m){
          return { name: m.name, brand_name_raw: m.name, favicon_url: m.logo };
        }),
        companies_preview_totalcount: 3,
        sources_preview: QUELLEN.slice(0, 4).map(function(q){
          return { title: q.domain, favicon: q.logo };
        }),
        sources_totalcount: 4
      }]
    });
    return true;
  }

  /* Der Wechsel: ausblenden, tauschen, einblenden. Getauscht wird IM ausgeblendeten Zustand --
     ein Wechsel bei voller Deckkraft ist ein Sprung, und die Karte baut ihren Inhalt neu auf.
     Die Uhr laeuft erst, wenn die erste Karte steht. */
  function antwortLauf(root){
    var fenster = root.querySelector(".ulh-fen-antwort .ulh-fen-view");
    if (!fenster || fenster.__ulhLauf) return;
    fenster.__ulhLauf = true;
    var k = 0;
    root.__ulhSchrittAntwort = function(){
      fenster.classList.add("is-blende");
      setTimeout(function(){
        antwortFuellen(++k);
        /* Die Tooltips kommen mit jeder neuen Karte nach. */
        ohneTipps(root);
        hellHalten(root);
        fenster.classList.remove("is-blende");
      }, ANTWORT_BLENDE);
    };
  }

  /* ---------- EIN Taktgeber fuer alle Nebenfenster ------------------------------------------
     Gemeldet: "ultra hektisch, quasi die ganze Zeit aendert sich irgendwo irgendwas". Der Grund
     war, dass jedes Fenster seine eigene Uhr hatte -- 5000ms fuer die Teams, 7000 fuer den Ring,
     5200 plus Blende fuer die Antwortkarte. Drei Perioden, die nicht ineinander aufgehen, ergeben
     ein Bild, in dem praktisch nie Ruhe ist, und genau das war zu sehen.
     Jetzt gibt es EINEN Takt, und ein Muster sagt, was in welchem Schlag passiert. Zwei Dinge
     sind daran wichtig:
       - es gibt LEERE Schlaege. Ruhe ist der halbe Eindruck; ohne sie wirkt das Fenster nervoes,
         egal wie langsam das Einzelne laeuft.
       - manchmal bewegen sich ZWEI Fenster zusammen. Das liest sich als ein Vorgang ("die App
         hat neue Daten") statt als drei unabhaengige Zappler.
     Das Muster laeuft im Kreis: 12 Schlaege a 3,2s sind gut 38 Sekunden, bis sich etwas
     wiederholt -- laenger, als jemand auf ein Schaustueck schaut. */
  var TAKT_MS = 3200;
  var TAKT_MUSTER = [
    ["teams"],            /* 1 */
    [],                   /* 2  Ruhe */
    ["antwort", "ring"],  /* 3  zwei zusammen */
    [],                   /* 4  Ruhe */
    ["teams"],            /* 5 */
    ["antwort"],          /* 6 */
    [],                   /* 7  Ruhe */
    ["ring"],             /* 8 */
    ["teams", "antwort"], /* 9  zwei zusammen */
    [],                   /* 10 Ruhe */
    ["antwort"],          /* 11 */
    []                    /* 12 Ruhe */
  ];
  function taktgeber(root){
    if (root.__ulhTaktAn) return;
    root.__ulhTaktAn = true;
    var i = -1;
    setInterval(function(){
      i = (i + 1) % TAKT_MUSTER.length;
      var dran = TAKT_MUSTER[i];
      for (var j = 0; j < dran.length; j++){
        /* Jeder Schritt in seinem eigenen try: ein Fenster, das noch nicht steht, darf die
           anderen nicht mitnehmen. */
        try {
          if (dran[j] === "teams"   && root.__ulhSchrittTeams)   root.__ulhSchrittTeams();
          if (dran[j] === "ring"    && root.__ulhSchrittDonut)   root.__ulhSchrittDonut();
          if (dran[j] === "antwort" && root.__ulhSchrittAntwort) root.__ulhSchrittAntwort();
        } catch (e){}
      }
    }, TAKT_MS);
  }

  /* Hover ja, Klick nein. Die Knoepfe, Aufklapper und Zeilen im Fenster SOLLEN auf die Maus
     reagieren -- das ist der halbe Eindruck von "lebendige App" -- aber nichts davon darf wirklich
     etwas tun: ein aufgeklapptes Menue oder eine umsortierte Tabelle mitten im Hero ist ein Zustand,
     aus dem der Besucher nicht mehr herausfindet.
     pointer-events: none koennte das nicht leisten, denn es nimmt genau die Hover-Zustaende mit weg.
     Also bleiben die Zeiger-Ereignisse erlaubt und die HANDLUNGEN werden geschluckt: in der
     Einfangphase, damit es geschieht, bevor irgendein Zuhoerer der Komponenten dran ist.
     mousedown und pointerdown gehoeren dazu -- die Aufklapper der App haengen daran, nicht an
     click. Bewegungsereignisse (mouseover, mouseenter, mousemove) sind ausdruecklich NICHT dabei. */
  function nurSchauen(root){
    /* Auch die Nebenfenster: die Antwortkarte ist ein Knopf (role="button", eigener Klick auf die
       Zeile), und ein Klick darauf loeste in der Komponente einen Weg nach Bubble aus, den es hier
       nicht gibt. */
    [].slice.call(root.querySelectorAll(".ulh-view, .ulh-fen-view")).forEach(nurSchauenIn);
  }
  function nurSchauenIn(view){
    if (!view || view.__ulhStumm) return;
    view.__ulhStumm = true;
    ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup",
     "keydown", "keypress", "submit", "focusin", "contextmenu"].forEach(function(art){
      view.addEventListener(art, function(e){
        e.preventDefault();
        e.stopPropagation();
      }, true);
    });
  }

  /* Die drei Zeichen in der Treiberzeile. Aus UC.icon und nicht selbst gezeichnet -- chartColumnUp,
     users und dollarSign stehen alle in core. Nachgesetzt und nicht beim Bauen, weil die Buehne
     steht, bevor core geladen ist; deshalb steht der Aufruf auch in der Uhrenkette. */
  /* ---- DER SENDEKNOPF TRAEGT EINEN PFEIL (24.09. gemeldet: "da stimmt das Icon nicht, ist ein
     arrow up in der Hauptapp") ------------------------------------------------------------------
     Das Markup dieser Sektion wird aus den Bubble-Vorlagen erzeugt, und dort steht im Sendeknopf
     das, was core arrowUp nennt -- das ist aber ein Chevron (ein Haken ohne Schaft, siehe
     core.js). Miras Element in der App traegt einen echten Pfeil, und die Landingpage soll
     zeigen, was der Nutzer sieht.
     Gezeichnet und nicht aus UC.icon: core hat keinen Pfeil nach oben, sein arrowUp IST der
     Chevron. Ihn dort zu aendern hiesse, die Hauptapp zu aendern -- und diese Runde ist
     ausdruecklich nur fuer die Landingpage. Also hier, mit derselben Form wie in Miras Element:
     Schaft plus Spitze, Feather.
     Nachgezogen wird wie jedes andere Zeichen im Fenster -- die Vorlage kommt spaeter als diese
     Datei, und der Knopf wird beim Umbau des Composers noch einmal angefasst. */
  var SENDE_PFEIL = '<svg width="24" height="24" viewBox="0 0 24 24" class="am-ic am-ic-send"' +
    ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
    ' stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12L12 5L19 12"/></svg>';
  function sendePfeil(root){
    var knopf = root.querySelector("#am-send");
    if (!knopf) return;
    var alt = knopf.querySelector("svg.am-ic-send");
    if (!alt || knopf.__ulhPfeil) return;
    knopf.__ulhPfeil = true;
    alt.outerHTML = SENDE_PFEIL;
  }

  function zeichenSetzen(root){
    var kern = window.UpstreemCore;
    if (!kern || !kern.icon) return;
    /* Jedes [data-ic] im Fenster, nicht nur die drei in der Treiberzeile: die Nebenfenster
       brauchen dieselbe Nachlieferung (Lupe im Suchfeld, Haken in der aktiven Teamzeile). Die
       Strichstaerke steht am Element, wo sie von 1.9 abweicht -- die Zeichen der App sind
       duenner als die grossen in der Treiberzeile. */
    var alle = root.querySelectorAll("[data-ic]");
    for (var i = 0; i < alle.length; i++){
      var el = alle[i];
      var stark = parseFloat(el.getAttribute("data-ic-w")) || 1.9;
      var svg = kern.icon(el.getAttribute("data-ic"), stark);
      if (!svg) continue;
      el.insertAdjacentHTML("afterbegin", svg);
      el.removeAttribute("data-ic");
    }
    sendePfeil(root);
  }

  /* Der Umschalter heisst hier D, W und M. Die langen Namen stehen im Markup der Komponente, und
     das kommt erzeugt aus der Bubble-Vorlage -- also hier gekuerzt und nicht dort, sonst waere es
     eine Aenderung an der App. */
  function schalterKuerzen(root){
    var kurz = { Day: "D", Week: "W", Month: "M" };
    var btns = root.querySelectorAll(".vc-gran-btn");
    for (var i = 0; i < btns.length; i++){
      var t = btns[i].textContent.trim();
      if (kurz[t]) btns[i].textContent = kurz[t];
    }
  }

  /* Der Tooltip des Charts steht dauerhaft offen, auf dem dritten der sechs Monate -- das ist heute
     Mai. DRITTER PUNKT und nicht "Mai": die sechs Monate laufen bis zum aktuellen, ein fester
     Monatsname waere in vier Wochen nicht mehr dabei. So bleibt er immer in der Mitte.
     Chart.js haelt die Instanz an der Leinwand (Chart.getChart) -- ueber diesen Weg, weil die
     Komponente sie nicht herausgibt und ein Umbau an ihr fuer ein Schaustueck der falsche Preis
     waere. setActiveElements setzt die Punkte, tooltip.setActiveElements zeichnet den Kasten.
     Auf mouseleave raeumt Chart.js beides ab, deshalb der Zuhoerer: nach dem Zeigen steht der
     Tooltip wieder da, wo er hingehoert. */
  var TIPP_PUNKT = 2;

  function tippZeigen(root){
    var leinwand = root.querySelector(".up-line-canvas");
    if (!leinwand || !window.Chart || !window.Chart.getChart) return false;
    var chart = window.Chart.getChart(leinwand);
    if (!chart || !chart.data || !chart.data.datasets || !chart.data.datasets.length) return false;
    var punkte = chart.data.datasets.map(function(_, di){
      return { datasetIndex: di, index: TIPP_PUNKT };
    });
    function setzen(){
      try {
        if (chart.tooltip && chart.tooltip.setActiveElements){
          /* Erst LEEREN, dann setzen. Chart.js vergleicht in setActiveElements die neuen aktiven
             Elemente mit den bisherigen und tut nichts, wenn sie gleich sind -- und nach einem
             Datentausch sind sie gleich, weil Chart.js dieselben Punktobjekte weiterverwendet. Der
             Tooltip behielt dadurch seine ALTEN Zahlen: gemessen zeigte er die ganze Bewegung ueber
             36.2, 32.0, 25.5 ..., obwohl die Datensaetze schon die neuen Werte trugen, und rechnete
             sich erst 830ms spaeter neu. Mit dem Leerlauf davor schlaegt der Vergleich fehl und der
             Kasten wird sofort neu gerechnet.
             Beides im selben Durchgang, also wird zwischen den zwei Zustaenden kein Bild gezeichnet
             -- es flackert nicht. */
          chart.tooltip.setActiveElements([], { x: 0, y: 0 });
          chart.tooltip.setActiveElements(punkte, { x: 0, y: 0 });
        }
        chart.update();
        /* Die aktiven Punkte des CHARTS erst NACH dem update, nicht davor: chart.update() raeumt
           chart._active ab, und ohne die aktiven Punkte zeichnet Chart.js keine Hoverpunkte -- die
           Fuehrungslinie stand allein da, ohne die weissen Kreise darauf. Mit einer Pixelprobe auf
           der Leinwand gemessen. */
        chart.setActiveElements(punkte);
      } catch (e){}
    }
    setzen();
    if (!leinwand.__ulhTipp){
      leinwand.__ulhTipp = true;
      leinwand.addEventListener("mouseleave", function(){ setTimeout(setzen, 60); });
    }
    return true;
  }

  /* Keine Tooltips. Sie haengen an data-tip (und in der Leiste an data-tiplabel), und das Kit von
     core baut daraus ein Element AN <body> -- ausserhalb dieser Sektion, also mit einer CSS-Regel
     von hier gar nicht erreichbar. Deshalb an der Quelle: die Attribute kommen weg, dann hat das
     Kit nichts zu zeigen.
     Wiederholt, weil die Komponenten ihr Markup ueber mehrere Sekunden aufbauen und die Leiste ihre
     Zeilen bei jeder Aenderung neu schreibt -- deshalb steht der Aufruf auch in der Uhrenkette. */
  function ohneTipps(root){
    /* Alle Schirme, nicht nur der des Hauptfensters: in den Nebenfenstern stehen dieselben
       Bauteile mit denselben Attributen (die Antwortkarte traegt data-tip am Datum und an jedem
       Markenzeichen). Ein Tooltip, der nur in einem der vier Fenster erscheint, waere der
       auffaelligste Unterschied zwischen ihnen. */
    [].slice.call(root.querySelectorAll(".ulh-view, .ulh-fen-view")).forEach(ohneTippsIn);
  }
  function ohneTippsIn(view){
    if (!view) return;
    /* data-explain gehoert dazu: daran haengt das Erklaerungs-Popover von core, und die Zeile mit
       den Datenpunkten unter jeder Antwort traegt es (am-evidence, data-explain="evidence"). Ohne
       diese Zeile erschien beim Ueberfahren ein Kasten mit einer Erklaerung, die auf der
       Landingpage niemandem hilft. */
    ["data-tip", "data-tiplabel", "data-explain"].forEach(function(attr){
      var treffer = view.querySelectorAll("[" + attr + "]");
      for (var i = 0; i < treffer.length; i++) treffer[i].removeAttribute(attr);
    });
  }

  /* Die Landingpage ist HELL, immer. core liest beim Start localStorage.pref_theme und setzt allen
     .up-root-Elementen data-theme -- wer die App schon einmal im Dunkeln benutzt hat, saehe hier
     also ein dunkles Dashboard auf weissem Grund. Gemessen: genau das passierte.
     Also ein Waechter an den Wurzeln hier drin, der das Dunkle wieder herausnimmt, falls es kommt.
     Nur schreiben, wenn der Wert abweicht -- sonst loest der Waechter sich selbst wieder aus.
     HELL HEISST HIER WIE IN CORE: KEIN data-theme, data-isdark "no" (06.10. umgestellt). Bis dahin
     schrieb diese Stelle data-theme="light" -- und core, dem themaHell() das helle Thema gesagt
     hat, nimmt genau dieses Attribut fuer hell wieder weg (applyThemeTo), bei JEDEM neuen Knoten
     auf der Seite. Zwei Schreiber im Wechsel: gemessen sieben Wurzeln der Shopping-Seite mitten im
     Einlauf ihrer Zeilen, und jede Komponente mit einem Waechter auf data-isdark zeichnete mit.
     Die Sorge von damals ("ohne das Attribut gilt das Betriebssystem") traegt nicht mehr: keine
     der geladenen Dateien hat noch eine Regel auf prefers-color-scheme, eine .up-root ohne
     data-theme ist hell (core.css, ":root, .up-root, [data-theme=light]"). Ein "light", das eine
     Komponente selbst setzt, bleibt stehen -- es bedeutet dasselbe. */
  function hellHalten(root){
    var alle = [root].concat([].slice.call(root.querySelectorAll(".up-root")));
    alle.forEach(function(el){
      /* EIN Nebenfenster ist dunkel (die URL-Typen). Es traegt data-ulh-dunkel, und alles darin
         bekommt hier das dunkle Thema statt des hellen -- derselbe Waechter, nur mit dem anderen
         Wert. Ohne diese Abfrage haette der Waechter das Fenster im naechsten Takt wieder
         aufgehellt, und der Doughnut haette dunkle Farben auf hellem Grund gezeichnet.
         data-up-thema-fest sagt core, dass es diese Wurzel nicht anfassen soll (applyThemeTo) --
         sonst setzte core sie bei jedem neuen Knoten hell und dieser Waechter zurueck. */
      var dunkel = el.closest && el.closest("[data-ulh-dunkel]");
      if (dunkel){
        if (el.classList.contains("up-root") && !el.hasAttribute("data-up-thema-fest")) el.setAttribute("data-up-thema-fest", "");
        if (el.getAttribute("data-theme") !== "dark") el.setAttribute("data-theme", "dark");
        if (el.getAttribute("data-isdark") !== "yes") el.setAttribute("data-isdark", "yes");
        return;
      }
      if (el.getAttribute("data-theme") === "dark") el.removeAttribute("data-theme");
      if (el.getAttribute("data-isdark") !== "no") el.setAttribute("data-isdark", "no");
    });
  }

  /* Und ein Waechter, der es HAELT. hellHalten allein reicht nicht: die Komponenten setzen ihr
     Thema beim Start selbst, und zwar so, dass sie data-theme ENTFERNEN, wenn sie nicht dunkel
     sind (prompts-table.js: "if (isDark) setAttribute else removeAttribute"). Ohne das Attribut
     gilt wieder, was der Rechner des Besuchers eingestellt hat -- und auf einem dunkel gestellten
     Rechner blitzen dann einzelne Teile dunkel auf, mitten in einer hellen Seite.
     Der Beobachter sieht jede neue Wurzel und jede Aenderung an data-theme und stellt das helle
     Thema wieder her. Eine Schleife entsteht daraus nicht: hellHalten schreibt nur, wenn der Wert
     wirklich falsch ist. */
  function hellBewachen(root){
    if (!window.MutationObserver) return;
    var laeuft = false;
    var beob = new MutationObserver(function(){
      if (laeuft) return;
      laeuft = true;
      requestAnimationFrame(function(){ laeuft = false; hellHalten(root); });
    });
    beob.observe(root, { childList: true, subtree: true,
      attributes: true, attributeFilter: ["data-theme", "data-isdark", "class"] });
  }

  /* Die Seitenleiste haengt sich SELBST an <body> und ist position: fixed. In der App muss das so
     sein -- sie steht neben allem und scrollt nicht mit. Fuer das Fenster holen wir sie herein:
     liegt ein Vorfahre mit transform darueber, bezieht sich fixed auf DIESEN Vorfahren und nicht
     mehr auf das Browserfenster. Damit sitzt die Leiste im Ausschnitt und wird mitverkleinert.
     Die zwei Handhaben fuer das Telefon (Knopf und Vorhang) bleiben nicht: im Fenster drueckt sie
     niemand, und der Vorhang wuerde ueber der halben Buehne liegen. */
  function leisteHolen(root){
    var side = root.querySelector(".ulh-side");
    var bar = document.querySelector('.usn-bar[data-usn-instance="' + ID.usn + '"]');
    if (!side || !bar) return false;
    if (bar.parentNode !== side) side.appendChild(bar);
    ["usn-fab", "usn-scrim"].forEach(function(k){
      var el = document.querySelector("." + k + '[data-usn-instance="' + ID.usn + '"]');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    return true;
  }

  /* Auf schmalen Schirmen steht die Leiste im Fenster EINGEKLAPPT. Ausgeklappt nimmt sie von 390px
     Schirmbreite 224 weg -- vom Inhalt der App bliebe ein Streifen, und genau darum geht es in
     diesem Fenster.
     Warum nicht sidebar.js entscheiden lassen: das tut es nach der FENSTERbreite, und seine
     Antwort waere hier "hint" -- ganz weg, erreichbar ueber einen Knopf, den leisteHolen entfernt
     hat. Also setzen wir es selbst.
     Und zwar bei jeder Aenderung an der Klasse: sidebar.js schreibt sie beim Umbauen neu, und ein
     einmaliges Setzen waere danach wieder ueberschrieben. Geschrieben wird nur, was fehlt --
     sonst triebe der Beobachter sich selbst an. */
  var LEISTE_MINI_AB = 900;
  function leisteMiniHalten(root){
    var bar = root.querySelector(".usn-bar");
    if (!bar || bar.__ulhMini) return;
    bar.__ulhMini = true;
    function setzen(){
      var breite = window.innerWidth || document.documentElement.clientWidth || 0;
      if (breite > LEISTE_MINI_AB) return;                 /* breiter Schirm: sidebar.js entscheidet */
      if (!bar.classList.contains("is-mini")) bar.classList.add("is-mini");
      if (bar.classList.contains("is-hidden")) bar.classList.remove("is-hidden");
    }
    setzen();
    window.addEventListener("resize", setzen, { passive: true });
    /* SOFORT im Beobachter, nicht ueber requestAnimationFrame: in einem Tab, der im Hintergrund
       liegt, laeuft rAF nicht -- die Leiste stand dann in dem Zustand, den sidebar.js zuletzt
       geschrieben hat, und zwar so lange, bis jemand den Tab wieder ansieht. Eine Schleife
       entsteht daraus nicht, weil setzen() nur schreibt, was fehlt: der naechste Durchlauf des
       Beobachters findet alles richtig vor und schreibt nichts mehr. */
    if (window.MutationObserver){
      new MutationObserver(setzen).observe(bar, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* ---- Womit verkleinert wird: transform oder zoom ------------------------------------------
     Beides sieht gleich aus und misst gleich -- geprueft am laufenden Fenster: Rechteck 682,
     offsetWidth 1104, Klassen der Tabelle identisch. Der Unterschied liegt im ZEICHNEN:

       transform  zeichnet die App in voller Groesse und verkleinert das BILD. Eine 1px-Linie wird
                  dabei zu 0.62 Bildpunkten. Auf einem Schirm mit doppelter Aufloesung sind das
                  immer noch 1.24 Geraetepixel und es faellt nicht auf; auf einem gewoehnlichen
                  Windows-Schirm (ein Geraetepixel je CSS-Pixel) verteilt der Browser die Linie auf
                  zwei und sie wird unscharf und wirkt dicker. Genau das war gemeldet.
       zoom       verkleinert im LAYOUT. Rahmen werden dabei auf ganze Geraetepixel gelegt, statt
                  ein fertiges Bild zu strecken.

     Warum nicht ueberall zoom: auf den Schirmen, auf denen es heute gut aussieht, ist transform
     der Zustand, der hier gemessen und ueber Wochen geprueft ist. Umgestellt wird deshalb nur
     dort, wo das Problem entsteht -- unter zwei Geraetepixeln je CSS-Pixel (die Begruendung
     fuer genau diese Grenze steht unten an der Zeile, die sie zieht).
     Ein frueherer Kommentar in der CSS sagte, zoom loese die schmalen Fassungen der Bauteile aus.
     Das war einmal so; heute liefert Chrome fuer beide Wege dieselben Rechtecke, und die Messung
     oben zeigt es. */
  function verkleinerungSetzen(root, m){
    var app = root.querySelector(".ulh-app");
    if (!app) return;
    var dpr = window.devicePixelRatio || 1;
    /* Bis 2 und nicht bis 1.5. Windows steht selten auf 100%: die ueblichen Einstellungen sind
       125, 150 und 175 Prozent, und das sind 1.25, 1.5 und 1.75 Geraetepixel je CSS-Pixel. Die
       alte Grenze liess damit genau die haeufigsten Faelle im transform-Pfad -- gemeldet war
       "besser, aber die kleinen Teile noch unsauber", und 150% faellt genau dazwischen.
       Gemessen am laufenden Fenster (zoom 0.65, dpr 2): eine 1px-Linie kommt unter zoom als
       0.5 CSS-Pixel heraus, also GENAU ein Geraetepixel -- der Browser legt sie auf das Raster.
       Unter transform bleibt sie 0.65 breit und wird auf zwei Pixel verteilt.
       Bei 2 ist Schluss: dort ist transform seit Wochen im Einsatz und sieht gut aus, und dort
       sitzen die Macs samt Safari, dessen zoom sich anders verhaelt als das von Chrome. */
    var mitZoom = dpr < 2;
    root.classList.toggle("is-zoom", mitZoom);
    if (mitZoom){
      app.style.transform = "none";
      app.style.zoom = m.toFixed(4);
    } else {
      app.style.zoom = "";
      app.style.transform = "";           /* dann gilt wieder die Regel aus der CSS */
    }
  }

  /* Die Verkleinerung. Gerechnet aus der WIRKLICHEN Breite des Ausschnitts, nicht aus der des
     Fensters: das Fenster traegt den Rahmen, der Ausschnitt ist der Platz darin. */
  function mass(root){
    var view = root.querySelector(".ulh-view");
    if (!view) return;
    var b = view.clientWidth;
    if (!b) return;                                        /* verdeckter Tab, spaeter nochmal */
    /* Die Buehnenbreite kommt aus der CSS und steht nicht hier: sonst gibt es zwei Wahrheiten, und
       eine Aenderung an --ulh-buehne verschiebt das Bild, ohne dass das Mass mitgeht. */
    var basis = parseFloat(getComputedStyle(root).getPropertyValue("--ulh-buehne")) || 1360;
    /* Nie HOCH skalieren. Ist das Fenster breiter als die Basisbuehne, waechst die Buehne mit und
       das Mass bleibt bei 1: die App rendert dann in ihrer echten Groesse, so wie sie es auf einem
       breiten Schirm auch tut. Ein Mass ueber 1 blaeht stattdessen jede Schriftgroesse auf -- 13px
       wuerden auf einem 1920er Schirm als 17px erscheinen, und die App saehe aus wie mit der Lupe
       betrachtet. */
    var soll = Math.max(basis, b);
    root.style.setProperty("--ulh-buehne-ist", soll + "px");
    var m = b / soll;
    /* Auf schmalen Schirmen zusaetzlich 10 Prozent kleiner. Gemeldet: im Mobilemodus ist unten
       Inhalt abgeschnitten. Das ist dort BEABSICHTIGT (das Fenster ist flacher als die Buehne, der
       Schnitt laesst es wie eine laufende App aussehen) -- aber nicht so weit, dass eine ganze
       Karte fehlt. Zehn Prozent weniger Mass heissen zehn Prozent mehr Buehne im selben
       Ausschnitt, in beiden Richtungen.
       Warum hier und nicht in der CSS: --ulh-mass schreibt diese Funktion als Inline-Angabe an die
       Wurzel, und eine CSS-Regel kaeme nie dagegen an (ausser mit !important, und das ist
       verboten). Der Faktor gehoert also dorthin, wo das Mass entsteht.
       Die Grenze ist dieselbe 900px wie in der CSS -- steht sie an zwei Stellen verschieden, hat
       das Fenster einen Bereich, in dem Layout und Mass nicht zusammenpassen. */
    if ((window.innerWidth || 0) <= 900) m *= 0.90;
    root.style.setProperty("--ulh-mass", m.toFixed(4));
    verkleinerungSetzen(root, m);
    /* Und derselbe Wert an <html>, fuer alles, was ausserhalb der Buehne haengt und ihren Massstab
       trotzdem kennen muss. */
    try { document.documentElement.style.setProperty("--ulh-mass", m.toFixed(4)); } catch (e){}
    /* Die Buehne muss den Ausschnitt mindestens fuellen, sonst scheint unten der Grund durch.
       Genau fuellen und nicht mit Zugabe: ist der Inhalt hoeher, wird er abgeschnitten -- und
       genau dieser Schnitt mitten im Inhalt laesst es aussehen wie ein Blick in eine laufende
       App. Eine Zugabe wuerde stattdessen leere Flaeche unter den Inhalt legen. */
    var app = root.querySelector(".ulh-app");
    if (app) app.style.minHeight = Math.ceil(view.clientHeight / m) + "px";
    /* Der Platz fuer die Leiste muss reserviert werden: fixed nimmt sie aus dem Fluss, und ohne
       diese Breite beginnt der Seiteninhalt bei x=0 und liegt unter ihr. offsetWidth und nicht
       getBoundingClientRect: das eine ist die Breite im Layout, das andere die verkleinerte auf
       dem Schirm -- hier zaehlt die im Layout. Gemessen und nicht festgeschrieben, damit eine
       Aenderung an --usn-w nichts kaputt macht. */
    var bar = root.querySelector(".usn-bar");
    var side = root.querySelector(".ulh-side");
    if (bar && side && bar.offsetWidth) side.style.width = bar.offsetWidth + "px";
    /* Diese Messung MUSS wiederholt werden, und deshalb steht mass() auch in der Uhrenkette oben.
       setSidebarOpen animiert die Breite (transition width in sidebar.css) -- wer unmittelbar danach
       offsetWidth liest, bekommt den Startwert 64 statt der 250 am Ende. Gemessen: die Spalte blieb
       auf 64px stehen und die Leiste lag ueber dem Seiteninhalt. */
    /* Zuletzt die Nebenfenster: ihre Groesse haengt am Mass, das eben geschrieben wurde, und wann
       immer sich die Breite aendert, laeuft genau diese Funktion. */
    einpassen(root);
  }

  /* ---- Die Nebenfenster einpassen (28.09.) -------------------------------------------------
     Gemeldet: "Bei kleineren Bildschirmen verlassen die Fenster Team Switcher, URL Type und
     Response Detail einfach den Bildschirmrand. Das darf nicht sein. Es soll immer alles sichtbar
     sein. Die Fenster sollen sich erst noch ein Stueck HINTER (bzw. im Fall von URL Type VOR) die
     Hauptfenster-Komponente schieben. Dann soll alles anfangen herunterzuskalieren. Und links und
     rechts soll auf Desktop immer ca. 64px Abstand zum Bildschirmrand bleiben."
     Gemessen vorher, im kleinen Zustand: bei 1920px Seitenbreite stand die Antwortkarte 2px vor
     dem rechten Rand (ihr Schatten abgeschnitten), bei 1280 lagen Teams 121px und die Antwortkarte
     140px AUSSERHALB der Seite.

     Die Rechnung, in Pixeln der BUEHNE (vor ihrem transform):
       - Die Buehne wird um ihre Mitte verkleinert (transform-origin: center in landing-hero.css).
         Ein Punkt u der Buehne steht beim Faktor s also bei  mitte + s * (u - S/2).
       - Links darf nichts vor --ulh-kante stehen, rechts nichts hinter Breite minus Kante. Daraus
         folgt je Seite, wie weit ein Fenster bei s hinausragen darf.
       - Stufe 1: s bleibt beim Deckel-Faktor, und jedes Fenster rueckt so weit auf das
         Hauptfenster zu, wie es muss -- hoechstens so weit, dass --ulh-rein-max seiner eigenen
         Breite hinter (bzw. bei den URL-Typen ueber) dem Hauptfenster liegt. Gezaehlt wird die
         UEBERDECKUNG und nicht der Weg: Teams und Antwortkarte stehen in Ruhe 4px daneben, die
         URL-Typen liegen schon 11px darueber, und die Grenze soll fuer alle dasselbe bedeuten.
       - Stufe 2: ragt ein Fenster auch mit voller Einrueckung hinaus, wird s kleiner, bis es
         passt. s ist also das Kleinste aus dem Deckel-Faktor und dem, was jedes Fenster mit voller
         Einrueckung zulaesst -- und die Einrueckungen werden danach fuer DIESES s gerechnet, damit
         keines weiter rueckt als noetig.
     Gemessen wird am LAYOUT (getComputedStyle: left, width, transform-origin) und nicht am
     Rechteck auf dem Schirm: die Fenster tragen beim Auftritt eine eigene Bewegung (translate,
     scale .94), und ein Rechteck mitten darin waere eine Momentaufnahme davon. Das Layout kennt
     nur die Ruhelage. Die MITTE der Buehne kommt dagegen aus dem Rechteck -- sie bleibt unter jedem
     Faktor stehen, weil um sie herum verkleinert wird, auch mitten in der Bewegung.
     Das Ergebnis wirkt an zwei Stellen: --ulh-rein am Fenster (die CSS schiebt damit left/right)
     und root.__ulhEinpassung, das kleinFaktor() liest. */
  function einpassen(root){
    var buehne = root.querySelector(".ulh-buehne");
    if (!buehne) return;
    var fenster = [].slice.call(root.querySelectorAll(".ulh-fen")).filter(function(el){
      return getComputedStyle(el).display !== "none";
    });
    /* Unter 900px sind die Nebenfenster aus (landing-hero.css, KLEINE SCHIRME), und die Buehne
       wird dort gar nicht verkleinert (anwenden) -- es gibt nichts einzupassen. */
    if (!fenster.length){ root.__ulhEinpassung = null; return; }
    var deckel = deckelFaktor(root);
    var kante = parseFloat(getComputedStyle(root).getPropertyValue("--ulh-kante"));
    /* Ohne @property kommt der Ausdruck statt der Zahl an; 64 ist dann der Wert, den die Spur aus
       demselben Ausdruck rechnet. */
    if (!(kante >= 0)) kante = 64;
    var S = parseFloat(getComputedStyle(buehne).width);
    var rr = root.getBoundingClientRect(), br = buehne.getBoundingClientRect();
    /* Verkleinert ein Vorfahre die ganze Sektion, stehen die Rechtecke in dessen Mass und das
       Layout nicht -- zurueckgerechnet, damit alles in derselben Einheit steht. */
    var aussen = root.offsetWidth ? rr.width / root.offsetWidth : 1;
    if (!S || !aussen) return;
    var mitte = ((br.left + br.right) / 2 - rr.left) / aussen;
    var platzL = mitte - kante, platzR = root.clientWidth - kante - mitte;
    /* Das Hauptfenster muss selbst auch passen. Unterhalb des Deckels steht es im grossen Zustand
       genau auf der Kante, also bei jedem s unter 1 von selbst -- die Zeile ist die Sicherung fuer
       eine Seite, die nicht so gebaut ist. */
    var s = Math.min(deckel, platzL / (S / 2), platzR / (S / 2));
    var daten = fenster.map(function(el){
      var cs = getComputedStyle(el);
      var b = parseFloat(cs.width), l = parseFloat(cs.left);
      /* Das eigene transform der Ruhelage: nur die URL-Typen tragen eins (--ulh-fs, um die
         rechte untere Ecke). Sichtbar breit ist ein Fenster also b * fs, und wo diese Breite
         steht, sagt der Ursprung. */
      var fs = parseFloat(cs.getPropertyValue("--ulh-fs")) || 1;
      var ox = parseFloat(cs.transformOrigin) || 0;
      var vb = b * fs, vl = l + ox * (1 - fs);
      var jetzt = parseFloat(el.style.getPropertyValue("--ulh-rein")) || 0;
      var links = vl + vb / 2 < S / 2;
      /* Die Lage OHNE Einrueckung: die AEUSSERE Kante (links die linke, rechts die rechte) und
         wie weit das Fenster dann schon ueber dem Hauptfenster liegt (negativ: Luft dazwischen). */
      var ruhe = links ? vl - jetzt : vl + vb + jetzt;
      var ueber = links ? ruhe + vb : S - (ruhe - vb);
      var d = { el: el, links: links, ruhe: ruhe,
                name: (String(el.className).match(/ulh-fen-(\w+)/) || [])[1] || "?",
                max: Math.max(0, (parseFloat(cs.getPropertyValue("--ulh-rein-max")) || 0) * vb - ueber) };
      var weit = links ? S / 2 - d.ruhe - d.max : d.ruhe - S / 2 - d.max;
      if (weit > 0) s = Math.min(s, (links ? platzL : platzR) / weit);
      return d;
    });
    if (!(s > 0)) s = deckel;
    /* Auf die vier Stellen, die anwenden() ins transform schreibt -- gerechnet wird mit dem Wert,
       der wirklich dasteht. Muss verkleinert werden, nach UNTEN: ein Hauch kleiner haelt die
       Kante, ein Hauch groesser nicht. Passt alles beim Deckel, bleibt es bei dessen gerundetem
       Wert, sonst stuende das kleine Fenster auf breiten Seiten bei 1299.9 statt 1300. */
    s = s < deckel ? Math.floor(s * 10000) / 10000 : +deckel.toFixed(4);
    var rein = {};
    daten.forEach(function(d){
      var grenze = d.links ? S / 2 - platzL / s : S / 2 + platzR / s;
      var x = d.links ? grenze - d.ruhe : d.ruhe - grenze;
      x = Math.max(0, Math.min(d.max, x));
      var wert = x.toFixed(2) + "px";
      /* Nur schreiben, was sich aendert: mass() laeuft in der Uhrenkette mehrmals, und jedes
         Schreiben macht das Layout schmutzig. */
      if (d.el.style.getPropertyValue("--ulh-rein") !== wert) d.el.style.setProperty("--ulh-rein", wert);
      rein[d.name] = +x.toFixed(2);
    });
    var vorher = root.__ulhEinpassung ? root.__ulhEinpassung.faktor : null;
    root.__ulhEinpassung = { faktor: s, deckel: deckel, kante: kante, rein: rein };
    /* Steht die Buehne schon klein da (Neuladen mitten auf der Seite, Fenster gezogen), soll der
       neue Faktor sofort gelten und nicht erst mit dem naechsten Takt. */
    if (!root.__ulhGroesseAnwenden) return;
    /* Und OHNE die 1800ms-Fahrt, wenn sich der Faktor aendert, waehrend die Buehne schon klein
       steht -- das ist ein gezogenes Fenster, kein Scrollen. Die Einrueckung (left/right) springt
       sofort auf den neuen Wert, der Faktor liefe sonst noch fast zwei Sekunden hinterher, und so
       lange stuenden die Nebenfenster zu gross und damit ueber dem Rand. Beim ersten Rechnen
       (vorher null) nicht: dann laeuft gerade der Auftritt, und der soll fahren.
       Der Weg ist der uebliche: Uebergang aus, Wert setzen, Stil einmal auswerten lassen
       (offsetWidth), Uebergang zurueck -- danach gibt es keinen Unterschied mehr, der fahren
       koennte. */
    var springen = vorher !== null && vorher !== s && root.classList.contains("is-klein");
    if (springen) buehne.style.transition = "none";
    root.__ulhGroesseAnwenden();
    if (springen){ void buehne.offsetWidth; buehne.style.transition = ""; }
  }

  /* ---------- Daten hineingeben ----------------------------------------------------------- */

  function fuellen(){
    /* DAS UPSTREEM-BRANDING IN DER LEISTE IST AUS (21.09. angefordert: "so wie vorher, bzw. wie
       in der Hauptapp, wenn man in den Preferences Branding anzeigen ausstellt").
       Genau dieser Schalter, nicht ein eigener Weg: sidebar.js liest UC.getPref("branding") und
       nimmt die Zeile bei "off" ganz aus dem Fluss (renderBrand). Ein display:none von hier waere
       ein zweiter Mechanismus fuer dieselbe Sache -- und haette den Einklappknopf oben stehen
       lassen, den die Leiste bei "off" selbst in die oberste Zeile umhaengt.
       VOR den Settern: renderBrand laeuft beim Aufbau der Leiste. */
    if (window.UpstreemCore && window.UpstreemCore.setPref){
      window.UpstreemCore.setPref("branding", "off");
    }

    /* DIE FARBSKALA DER LINIEN: "linear" (21.09. angefordert). Sie liegt in der Ablage des
       Betrachters und nicht in den Daten -- die Marken tragen zwar ihre Farbe mit, aber ein
       gesetztes Schema schlaegt sie (buildLineDatasets in core.js), und die Vorgabe der App ist
       "tableau". Gemessen vorher: die Linien kamen als #5778a4/#e49444/... heraus, also Tableau.
       Also die Vorliebe setzen, EINMAL und bevor gezeichnet wird. Das aendert nichts in der App:
       der Schluessel gehoert dem Browser des Besuchers, und auf der Landingpage ist er sonst
       leer.
       Die Farbe haengt danach an der Reihenfolge der Datensaetze und nicht mehr an der Marke --
       so arbeitet buildLineDatasets, und die Legende sagt ohnehin, welche Linie wem gehoert.
       Gemessen danach: #579cf1 / #00aad3 / #00b1ab / #2db477 / #83a93a / #b69700, also genau
       COLOR_SCALES.linear. */
    if (window.UpstreemCore && window.UpstreemCore.setColorScalePref){
      window.UpstreemCore.setColorScalePref("linear");
    }
    var serie = reihen("a");
    var tab = tabelle("a");
    /* Die eigene Marke ist Acme und steht im Zustand A auf Platz 3 -- nicht tab[0]. Der
       Seitenkopf zeigt IHRE Zahlen, nicht die des Ersten. */
    var eigene = tab.filter(function(r){ return r.company_id === "ac"; })[0] || tab[0];

    /* ERST DEN PINSPEICHER LEEREN, DANN DIE LEISTE FUELLEN (21.09.). upstreemPinToSidebar HAENGT
       AN -- in der App ist das richtig, hier nicht: die Landingpage setzt ihre zwei Pins bei jedem
       Laden neu, und der Speicher liegt im Browser des Besuchers. Wer die Seite schon einmal
       gesehen hat, trug die Pins von damals weiter mit sich herum; nach dem Umbau auf Acme standen
       bei ihm vier Zeilen, zwei davon mit dem alten Markennamen. Genau so im Prueftand gesehen:
       "Acme / acme.com / Kestrel / kestrel.example".
       VOR setSidebarTeams und nicht davor bei den Pins: die Leiste liest ihren Speicher, sobald
       das Team eintrifft, und haelt die Liste danach im Arbeitsspeicher. Ein Loeschen danach kaeme
       zu spaet -- gemessen, die vier Zeilen standen weiter da.
       Der Schluessel ist der von sidebar.js (usn_pins__<instanz>@<team>) -- hier steht er ein
       zweites Mal, und das ist die eine Stelle, an der das vertretbar ist: eine API zum Leeren
       gibt es nicht, und die Landingpage darf die App dafuer nicht aendern. Beide Werte sind
       Konstanten dieser Datei, es kann also nichts auseinanderlaufen. */
    try { localStorage.removeItem("usn_pins__" + ID.usn + "@t1"); } catch(e){}
    /* Aus demselben Grund die gespeicherte Dashboard-Ansicht (core.js, DASH_STORE):
       data-mode-default sagt nur, was ein Geraet OHNE eigene Wahl sieht. Ein Besucher, der
       hier schon einmal war, als der Kopf noch auf Power stand, traegt diese Wahl weiter
       mit sich und saehe den schmalen Kopf ohne Beschreibung. Auf einer Schauseite gibt es
       keine Wahl des Besuchers, die es zu achten gaebe. */
    try { localStorage.removeItem("up_dashboard"); } catch(e){}

    if (window.setSidebarTeams){
      /* Acht Arbeitsbereiche -- DIESELBE Liste wie im Teamfenster weiter unten (TEAMS). Eine
         zweite Teamliste in derselben Sektion waere der Bruch, den man zuerst sieht. Nur das
         erste ist zu sehen (es ist das aktive); die anderen sieben zaehlen im Teams-Eintrag mit,
         und genau der soll 8 zeigen. */
      window.setSidebarTeams(ID.usn, TEAMS.map(function(t, i){
        return { id: "t" + (i + 1), name: t.name, domain: t.dom, favicon_url: t.logo };
      }));
      window.setSidebarUser(ID.usn, { name: "Alex Moreno", email: "alex@acme.com", avatar_url: "" });
      /* Vierzehn Marken im Store. Die Leiste zieht ihren Brands-Zaehler daraus, und er soll dieselbe
         Zahl nennen wie die Kopfzeile der Tabelle. Sichtbar sind die sechs mit einer Linie im
         Chart; die vier weiteren Hersteller des Feldes stehen in der Matrix und in den Prompts,
         und vier weitere zaehlen nur mit -- ein beobachteter Markt hat mehr Marken, als ein Chart
         Linien vertraegt, und genau das soll der Zaehler sagen. */
      if (window.setUpstreemBrands) window.setUpstreemBrands(
        MARKEN.concat(MARKEN_WEITER).map(function(m){ return { company_id: m.id, name: m.name }; }).concat(
          ["Skoda", "Seat", "Cupra", "Kia"]
            .map(function(n, i){ return { company_id: "x" + i, name: n }; })));
      if (window.setSidebarCount) window.setSidebarCount(ID.usn, 231);
      if (window.setSidebarActive) window.setSidebarActive(ID.usn, "dashboard");
      /* Offen und nicht als Schiene: die Beschriftungen sind der halbe Wiedererkennungswert. */
      if (window.setSidebarOpen) window.setSidebarOpen(ID.usn, "yes");
      if (window.setSidebarReady) window.setSidebarReady(ID.usn);
      /* Der Pinned-Block. Er entsteht nur, wenn etwas angeheftet ist -- eine Ueberschrift ohne
         Inhalt liesse die Leiste unfertig aussehen -- also hier zwei Pins: die eigene Marke und
         ihre Domain. NACH setSidebarTeams, weil der Speicher der Pins die Team-Id im Schluessel
         traegt; davor gaebe es keinen, in den geschrieben werden koennte.
         Zwei verschiedene Toene: die Marke in ihrem eigenen Blau, die Domain in einem gedeckten
         Gruen aus derselben Reihe -- zwei gleich blaue Quadrate untereinander lesen sich als eine
         Wiederholung und nicht als zwei Dinge. */
      if (window.upstreemPinToSidebar){
        /* ERST LEEREN, DANN ANHEFTEN (21.09.). upstreemPinToSidebar HAENGT AN -- in der App ist
           das richtig, hier nicht: die Landingpage setzt ihre zwei Pins bei jedem Laden neu, und
           der Speicher liegt im Browser des Besuchers. Wer die Seite schon einmal gesehen hat,
           trug deshalb die Pins von damals weiter mit sich herum; nach dem Umbau auf Acme standen
           bei ihm vier Zeilen, zwei davon mit dem alten Markennamen. Genau so im Prueftand
           gesehen: "Acme / acme.com / Kestrel / kestrel.example".
           Der Schluessel ist der von sidebar.js (usn_pins__<instanz>@<team>) -- hier steht er ein
           zweites Mal, und das ist die eine Stelle, an der das vertretbar ist: eine API zum
           Leeren gibt es nicht, und die Landingpage darf die App dafuer nicht aendern. Beide
           Werte sind Konstanten dieser Datei (ID.usn und das Team der Demodaten), es kann also
           nichts auseinanderlaufen. */

        /* Die Domain bekommt ihr Zeichen ueber denselben Weg wie jede andere Quelle. Frueher
           stand hier ein selbst gebautes Buchstabenkaestchen in einem zweiten Gruenton -- das
           gab es nur, solange die Marken erfunden waren. Jetzt ist der Pin das, was er in der
           App auch waere: die Domain mit ihrem Zeichen. */
        window.upstreemPinToSidebar({ type: "domain", id: "acme.com",
          label: "acme.com", logo: MARKEN[0].logo });
        window.upstreemPinToSidebar({ type: "brand", id: "ac",
          label: "Acme", logo: MARKEN[0].logo });
      }
    }

    if (window.setDashboardPageHeaderKpis){
      window.setDashboardPageHeaderKpis(ID.dph, [{
        avg_visibility_pct: eigene.visibility_pct,
        avg_visibility_delta_pct: eigene.visibility_delta_pct,
        avg_rank: eigene.avg_rank,
        avg_rank_delta: eigene.avg_rank_delta,
        avg_sentiment: eigene.sentiment,
        avg_sentiment_delta: eigene.sentiment_delta,
        has_own_brand: true
      }]);
    }

    if (window.renderVisibilityChart){
      window.renderVisibilityChart({
        instanceId: ID.vot,
        series: serie,
        companies: MARKEN.map(function(m){
          return { company_id: m.id, name: m.name, color: m.farbe, favicon_url: m.logo,
                   visibility_window_pct: m.a.vis };
        }),
        filterCompanies: MARKEN.map(function(m){
          return { company_id: m.id, name: m.name, color: m.farbe, favicon_url: m.logo };
        }),
        table: tab,
        /* 14 und nicht MARKEN.length: die Zahl neben "Top Brands" ist die Zahl ALLER Marken im
           Konto, nicht die der sechs sichtbaren Zeilen. In der App ist das auch so -- die Tabelle
           zeigt die oberen, der Zaehler nennt den Bestand. Dieselbe 14 steht deshalb auch im
           Marken-Store, aus dem die Leiste ihren Zaehler zieht. */
        totalCount: 14,
        granularity: "month"
      });
    }

    /* Die zwei Nebenfenster, die eigene Daten brauchen. Der Doughnut kommt aus core und braucht
       nur einen Koerper; die Antwortkarte ist eine echte Komponente mit eigenem Setter. */
    donutFuellenSpaeter();
    antwortFuellen(0);
    /* fuellen() bekommt keine Wurzel mit -- die Sektion ist ein Singleton, und der Lauf braucht
       sie nur, um Tooltips nachzuraeumen. */
    antwortLauf(document.querySelector(".ulh-root"));
    /* Die Kurven im Abschnitt darunter. Die drei anderen Vorschauen sind statisch. */
    (function(){ var w = document.querySelector(".ulh-root");
      if (!w) return;
      /* Die Fotos der Sektion nach dem ersten Bild des Heros, nicht mit ihm: 13 Bilder (rund
         400 KB) sollen nicht um die Leitung der Komponenten konkurrieren. Shopping kommt erst nach
         rund 20s, die Ad-Karte liegt unter dem Falz -- 1.2s spaeter ist frueh genug. */
      setTimeout(bilderVorladen, 1200);
      visLinieFuellen(w);
      /* Die dritte Reihe: Band und Bahnen werden gebaut und danach in Bewegung gesetzt. */
      visSprachenFuellen(w);
      visModelleFuellen(w);
      visBalkenFuellen(w);
      visEventKurveFuellen(w);
      ulhTakt(w);
      quellFuellen();
      /* NUR BEIM ERSTEN FUELLEN (28.09. gemessen): fuellen() laeuft am Ende JEDES Zyklus erneut
         (neustart), und beide starten etwas, das nie endet -- auftritte eine eigene
         requestAnimationFrame-Schleife, hellBewachen einen eigenen Beobachter. Neu gestartet
         stand nach jeder Runde einer mehr daneben: die Seite rechnete mit jedem Zyklus mehr. Die
         Stuecke, die auftritte einblendet (.ulh-auf), und die Wurzeln, die hellBewachen hell
         haelt, baut die Seite einmal beim Aufbau; die erste Schleife und der erste Beobachter
         sehen sie also alle, auch spaeter hinzukommende Wurzeln (der Beobachter haengt an der
         ganzen Sektion). */
      if (!w.__ulhDauerAn){
        w.__ulhDauerAn = true;
        auftritte(w);
        hellBewachen(w);
      }
      navLauf(w);
      leisteAuslagern(w);
      mscFuellen(w);
    })();

    if (window.renderTopCitations){
      window.renderTopCitations({
        instanceId: ID.tcd,
        mode: "domain",
        /* Balken statt Doughnut. Die Komponente kann beides und nimmt es aus dem Payload
           (topcitations-dashboard.js: params.chartMode) -- auf den Umschaltknopf zu klicken waere
           der Umweg gewesen, und klicken kann hier ohnehin niemand. */
        chartMode: "bar",
        totalCountDomain: 412,
        totalCountUrl: 1893,
        citations_total: 15899,
        top_domains: QUELLEN.map(function(q){
          return { domain: q.domain, favicon: q.logo,
                   share_pct: q.share_pct,
                   share_delta_pct: q.share_delta_pct, used_total: q.used_total,
                   citation_type: q.citation_type };
        }),
        top_urls: [],
        types_breakdown: TYPEN,
        brand: { id: "ac", name: "Acme", logo: MARKEN[0].logo },
        brandMentioned: ""
      });
    }
  }

  /* ---------- Der Filterwechsel ---------------------------------------------------------- */

  /* Drei Sekunden nachdem das Dashboard fertig steht, wechselt es EINMAL von Zustand A auf B -- wie
     ein Filterwechsel in der App: Acme steigt von Platz 3 auf 1, Porsche und Volvo tauschen 5 und
     6, alle sechs Linien im Chart fahren auf ihre neuen Werte, und jede Zahl zaehlt dorthin.
     Einmal und nicht im Kreis: eine Sektion, die sich alle drei Sekunden umsortiert, liest sich als
     Fehler und nicht als Funktion. Eine Folge mehrerer Szenen ist Schritt 2 der Landingpage.

     Der Wechsel laeuft NICHT ueber renderVisibilityChart. Das waere der kurze Weg und der falsche:
     der Setter schreibt die Tabelle als innerHTML neu -- dann gibt es keine Zeilen mehr, die
     wandern koennten -- und build() im Kit ruft destroy(), dann spielt die Eingangsanimation des
     Charts von vorn. Also von Hand: Chart.js bekommt neue Zahlen in seine Datensaetze und
     interpoliert sie mit seinen eigenen 600ms, die Zeilen wandern per FLIP, die Zahlen zaehlen. */

  /* ALLE ENDZUSTAENDE ZWEI SEKUNDEN LAENGER (21.09. angefordert: "generell ueberall die
     Endzustaende so 2s laenger"). Gemeint ist der Moment, in dem eine Szene FERTIG dasteht --
     nicht die Bewegung dorthin. Wer eine Sektion ansieht, braucht diesen Moment, um zu lesen,
     was da steht; die Bewegung hat er schon gesehen. */
  var SZENE_WARTEN = 5000;      /* nach dem fertigen Dashboard, nicht nach dem Skriptstart */
  /* ZWEI Dauern, und das ist Absicht.
     SZENE_DAUER gilt fuer das Zaehlen der Zahlen und fuer die Linien im Chart: 930ms, lang genug,
     dass man beim Zaehlen mitlesen kann.
     WANDER_DAUER gilt fuer das Verschieben der Zeilen -- in der Tabelle und im Tooltip. Eine Zeile,
     die eine ganze Sekunde braucht, um zwei Plaetze weit zu rutschen, wirkt schwerfaellig; eine
     zaehlende Zahl braucht die Zeit dagegen. 930, 700, 620 und 480 waren der Reihe nach alle zu
     traege -- jetzt 400ms. Die Zeilen stehen damit eine halbe Sekunde, bevor die Zahlen und die
     Linien fertig sind, und genau so ist es gewollt. */
  var SZENE_DAUER = 930;
  var WANDER_DAUER = 400;
  /* Der Zeitpunkt, an dem die Platzziffer springt -- die halbe Strecke DER WANDERUNG, ausgedrueckt
     in der Zeit des Zaehlwerks, weil die Ziffer aus dem Zaehlwerk gesetzt wird. Seit die zwei
     Dauern auseinanderliegen, waeren 0.5 des Zaehlwerks zwei Drittel der Wanderung. */
  var ZIFFER_BEI = (WANDER_DAUER / 2) / SZENE_DAUER;
  /* EINE Kurve fuer alles: ein sanftes Ausschleichen. Vorher zaehlten die Zahlen auf easeOutQuart,
     und das ist ein hartes Ausschleichen -- zur halben Zeit schon bei 94 Prozent, die Zahlen standen
     also praktisch fest, waehrend die Zeilen noch fuhren. easeOutQuad ist bei der halben Zeit bei
     75 Prozent, und Chart.js kennt denselben Namen fuer seine Datenanimation. */
  var WEICH = "cubic-bezier(.25,.46,.45,.94)";      /* easeOutQuad als Bezier, fuer die CSS-Seite */
  function weich(t){ return 1 - (1 - t) * (1 - t); } /* easeOutQuad fuer das Zaehlwerk */
  var KACHEL_MS = 200;          /* das Auf- und Abblenden von Fuellung und Linie der Kachel */
  var zustand = "a";

  /* Die Formate sind die der Komponenten und nicht neu erfunden -- sonst zaehlt eine Zelle in einer
     anderen Genauigkeit hoch, als sie danach anzeigt, und der letzte Schritt ist ein Sprung.
     Visibility-Zelle: UC.fmtPct ohne Stellen. Rang: UC.fmt1, eine Stelle. Sentiment: ganze Zahl.
     Trendzeichen: |d|, denn UC.trendChip zeigt den Absolutwert und traegt die Richtung im Pfeil. */
  function ganz(v){ return String(Math.round(v)); }
  function ganzProz(v){ return String(Math.round(v)) + "%"; }
  function eine(v){ return (Math.round(v * 10) / 10).toFixed(1); }
  function proz(v){ var k = window.UpstreemCore; return k ? k.fmtPct(v) : ganzProz(v); }

  /* Fuer den Tooltip des Charts: Zahl und Format aus dem TEXT lesen, statt sie festzuschreiben. Die
     Genauigkeit des Linechart-Tooltips steht in der Chart-Konfiguration (cfg.decimals, hier 0 mit
     Prozentzeichen) -- wer sie dort aendert, soll nicht hier nachziehen muessen. Das Drumherum
     ("%", ein Vorzeichen, was auch kommt) bleibt so stehen, wie es dasteht. */
  var LUECKE = " ";
  function zahlAus(text){
    var m = String(text == null ? "" : text).match(/-?\d+(?:\.\d+)?/);
    return m ? parseFloat(m[0]) : null;
  }
  function formatWie(text){
    var t = String(text == null ? "" : text);
    var m = t.match(/-?\d+(?:\.(\d+))?/);
    if (!m) return ganz;
    var stellen = m[1] ? m[1].length : 0;
    var rest = t.replace(m[0], LUECKE);
    return function(v){ return rest.replace(LUECKE, Number(v).toFixed(stellen)); };
  }

  /* Die Zahl im Trendzeichen ist ein TEXTKNOTEN hinter dem Pfeil-SVG (UC.trendChip: Icon + Text).
     Also den Knoten holen und nicht das Element beschreiben -- textContent auf dem Element haette
     den Pfeil mitgeloescht. */
  function trendText(chip){
    if (!chip) return null;
    var k = chip.lastChild;
    return (k && k.nodeType === 3) ? k : null;
  }

  /* Ein GEMEINSAMES Zaehlwerk fuer alle Zahlen des Wechsels: eine Schleife, nicht eine je Zahl.
     Zwanzig eigene rAF-Ketten laufen auseinander, und dann steht die Kopfzeile schon auf dem
     Endwert, waehrend die Tabelle noch unterwegs ist.
     Die Zeit kommt aus dem rAF-Argument und nicht aus einem Frame-Zaehler: ein gedrosselter Tab
     liefert weniger Frames, die Dauer soll aber dieselbe bleiben. */
  function zaehlwerk(dauer){
    var auftraege = [], laeuft = false, standE = 0, standT = 0;
    /* Ein Auftrag darf NACHTRAEGLICH dazukommen und holt dann den Stand sofort ein. Der Tooltip des
       Charts braucht das: seine Zeilen entstehen erst, wenn core ihn ein einziges Mal neu gebaut
       hat, und das ist ein Frame nach dem Datentausch. Ohne das Einholen zaehlte er von vorn,
       waehrend die Tabelle schon zur Haelfte durch ist. */
    function dazu(f){
      auftraege.push(f);
      if (laeuft) f(standE, standT);
    }
    return {
      /* el darf ein Element ODER ein Textknoten sein -- textContent schreibt auf beidem. */
      zahl: function(el, von, bis, form){
        if (!el) return;
        var a = Number(von), b = Number(bis);
        if (!isFinite(a) || !isFinite(b)) return;
        dazu(function(e){ el.textContent = form(a + (b - a) * e); });
      },
      /* Alles, was keine Zahl in einem Knoten ist: der Punkt des Sentiment-Zeichens wechselt die
         Farbe, die Platzziffer springt. Bekommt beide Zeiten -- e ist gekruemmt, t linear. */
      frei: function(fn){ if (fn) dazu(fn); },
      lauf: function(fertig){
        var start = null, fertigGemeldet = false;
        laeuft = true;
        function abschluss(){
          if (fertigGemeldet) return;
          fertigGemeldet = true;
          standE = 1; standT = 1;
          auftraege.forEach(function(f){ f(1, 1); });
          laeuft = false;
          if (fertig) fertig();
        }
        function schritt(jetzt){
          if (fertigGemeldet) return;
          if (start == null) start = jetzt;
          standT = Math.min(1, (jetzt - start) / dauer);
          standE = weich(standT);
          auftraege.forEach(function(f){ f(standE, standT); });
          if (standT < 1) requestAnimationFrame(schritt); else abschluss();
        }
        requestAnimationFrame(schritt);
        /* Rueckhalt. In einem verdeckten Tab feuert rAF gar nicht -- ohne diese Uhr blieben die
           Zahlen auf dem Anfangswert stehen, waehrend die Zeilen schon umsortiert sind: Platz 1 mit
           den Werten von Platz 3. Die Uhr laeuft auch verdeckt, gedrosselt, aber sie laeuft. */
        setTimeout(abschluss, dauer + 200);
      }
    };
  }

  /* FLIP: First, Last, Invert, Play -- der gemeinsame Kern beider Wanderungen. Der Aufrufer hat die
     alten Lagen gemessen und die Elemente in der neuen Ordnung eingehaengt; diese Funktion schiebt
     jedes per transform an seine ALTE Stelle zurueck und laesst es von dort auf 0 fahren.
     offsetTop und NICHT getBoundingClientRect: die Buehne steht unter transform: scale, und
     getBoundingClientRect liefert die verkleinerten Masse -- eine Wanderung von 47 Layoutpixeln
     kaeme als 33 heraus, und die Zeilen sprangen um den Rest. Gemessen bei 1024px Fensterbreite:
     der Weg bleibt 94px, mit dem Rect waeren es 70 gewesen.
     an/aus legen die Kachel an und ab: bei der Tabelle eine Klasse, beim Tooltip eine Fuellung. */
  function flip(reihe, dauer, an, aus){
    var UEBER = "box-shadow " + KACHEL_MS + "ms ease, background-color " + KACHEL_MS + "ms ease";
    reihe.forEach(function(r){
      r.weg = r.oben - r.el.offsetTop;
      if (!r.weg) return;
      r.el.style.position = "relative";
      /* Wer nach OBEN wandert, liegt vorn. Sonst entscheidet die Reihenfolge im Markup, welche von
         zwei sich kreuzenden Zeilen verdeckt wird, und das ist willkuerlich. */
      r.el.style.zIndex = r.weg > 0 ? "2" : "1";
      if (an) an(r.el);
      /* transform 0s statt transition: none -- der Sprung an die alte Stelle muss hart sein, das
         Aufblenden der Kachel aber nicht. Mit transition: none blitzte die Fuellung auf. */
      r.el.style.transition = "transform 0s, " + UEBER;
      r.el.style.transform = "translateY(" + r.weg + "px)";
    });
    /* Ein Lesen erzwingt das Layout mit dem gesetzten transform. Ohne diese Zeile fasst der Browser
       beide Zuweisungen zu einem Stil zusammen, und es gibt nichts zu ueberblenden. */
    if (reihe[0]) void reihe[0].el.offsetHeight;
    requestAnimationFrame(function(){
      reihe.forEach(function(r){
        if (!r.weg) return;
        r.el.style.transition = "transform " + dauer + "ms " + WEICH + ", " + UEBER;
        r.el.style.transform = "translateY(0)";
      });
    });
    /* Aufraeumen in ZWEI Schritten. Erst faellt die Kachel ab, und dafuer muss die Ueberblendung
       noch stehen -- sonst springt Fuellung und Linie weg, statt zu verschwinden. Erst danach
       kommen Ueberblendung, Lage und Stapelplatz weg.
       Die Uhr raeumt auch dann auf, wenn rAF nie gefeuert hat: dann springt die Zeile an ihren
       Platz, statt dort zu bleiben, wo sie vorher stand. */
    setTimeout(function(){
      reihe.forEach(function(r){
        r.el.style.transition = UEBER;
        r.el.style.transform = "";
        if (aus) aus(r.el);
      });
      setTimeout(function(){
        reihe.forEach(function(r){
          r.el.style.transition = "";
          r.el.style.position = "";
          r.el.style.zIndex = "";
        });
      }, KACHEL_MS + 60);
    }, dauer + 80);
  }

  function reihenWandern(root, ordnung, dauer){
    var tbody = root.querySelector(".vot-unit-right .vt-tbody");
    if (!tbody) return null;
    var vorher = {};
    [].slice.call(tbody.querySelectorAll(".vt-row")).forEach(function(z){
      vorher[z.getAttribute("data-id")] = { el: z, oben: z.offsetTop };
    });
    var reihe = ordnung.map(function(id){ return vorher[id]; }).filter(Boolean);
    /* Passt die Ordnung nicht auf die Zeilen, wird NICHTS angefasst. Eine halb umsortierte Tabelle
       waere schlimmer als eine unveraenderte. */
    if (reihe.length !== ordnung.length) return null;
    reihe.forEach(function(r){ tbody.appendChild(r.el); });
    flip(reihe, dauer,
      function(el){ el.classList.add("is-wandert"); },
      function(el){ el.classList.remove("is-wandert"); });
    return reihe;
  }

  /* ---- Der Tooltip des Charts ----
     Er steht dauerhaft offen und listet dieselben sechs Marken, sortiert nach ihrem Wert am
     gezeigten Monat. Beim Filterwechsel muss er dieselbe Bewegung machen wie die Tabelle, sonst
     springt er mitten in einer ruhigen Verschiebung um.
     Der Ablauf ergibt sich aus der Bauart des Tooltip-Kits in core: es baut den Kasten nur neu, wenn
     sich seine Kennung geaendert hat, und die enthaelt die ROHWERTE. Waehrend Chart.js die Linien
     animiert, bleiben die Rohwerte gleich -- es gibt also genau EINEN Neuaufbau, unmittelbar nach
     dem Datentausch, und danach gehoeren die Zeilen uns: weder ein weiteres chart.update() noch das
     Anstecken des Tooltips baut sie noch einmal.
     Deshalb: vor dem Tausch Lagen und Werte aufnehmen, auf den Neuaufbau warten, dann wandern und
     zaehlen lassen. Ein Zaehlen VOR dem Neuaufbau waere sinnlos, er ueberschreibt alles. */
  function tippAufnehmen(root){
    var box = root.querySelector(".up-line-tt");
    if (!box) return null;
    var zeilen = [].slice.call(box.querySelectorAll(".up-line-tt-row"));
    if (!zeilen.length) return null;
    var auf = { box: box, ordnung: [], lage: {}, wert: {} };
    zeilen.forEach(function(z){
      var id = z.getAttribute("data-id");
      var w = z.querySelector(".up-line-tt-val");
      auf.ordnung.push(id);
      auf.lage[id] = z.offsetTop;
      auf.wert[id] = w ? w.textContent : null;
    });
    return auf;
  }

  function tippWandern(auf, zeilen, werk, dauer){
    /* Die Fuellung der wandernden Zeile ist der Grund des Kastens -- KEIN Rahmen, die Zeilen haben
       keinen. Ohne Fuellung schlagen zwei Zeilen durcheinander, die sich kreuzen: Porsche und Volvo
       tauschen die Plaetze und stehen auf halber Strecke exakt uebereinander. Aus dem Kasten
       gelesen und nicht festgeschrieben, damit es im Dunkeln stimmt (dort #121212). */
    var innen = auf.box.firstElementChild || auf.box;
    var grund = getComputedStyle(innen).backgroundColor;
    var reihe = [];
    zeilen.forEach(function(z){
      var id = z.getAttribute("data-id");
      if (auf.lage[id] == null) return;
      reihe.push({ el: z, oben: auf.lage[id] });
      var w = z.querySelector(".up-line-tt-val");
      if (!w) return;
      var von = zahlAus(auf.wert[id]), bis = zahlAus(w.textContent);
      if (von == null || bis == null) return;
      werk.zahl(w, von, bis, formatWie(w.textContent));
    });
    if (!reihe.length) return;
    flip(reihe, dauer,
      function(el){ el.style.backgroundColor = grund; },
      function(el){ el.style.backgroundColor = ""; });
  }

  function tippNachziehen(auf, werk, dauer){
    if (!auf) return;
    (function warten(k){
      var zeilen = [].slice.call(auf.box.querySelectorAll(".up-line-tt-row"));
      /* Neu gebaut ist er, wenn Reihenfolge ODER ein Wert nicht mehr der Aufnahme entspricht.
         Beides pruefen und nicht nur die Reihenfolge: es gibt Wechsel, bei denen sich nur Zahlen
         aendern und die Reihenfolge bleibt. */
      var neu = zeilen.length === auf.ordnung.length && zeilen.some(function(z, i){
        var id = z.getAttribute("data-id");
        var w = z.querySelector(".up-line-tt-val");
        return id !== auf.ordnung[i] || (w && w.textContent !== auf.wert[id]);
      });
      if (neu){ tippWandern(auf, zeilen, werk, dauer); return; }
      /* Dreissig Frames Geduld, dann nicht mehr. Bleibt der Neuaufbau aus, steht der Tooltip einfach
         weiter da, wie er war -- kein Grund, dafuer irgendetwas anderes anzuhalten. */
      if (k < 30) requestAnimationFrame(function(){ warten(k + 1); });
    })(0);
  }

  /* Die Linien. Zugeordnet ueber __id und nicht ueber den Index: die Datensaetze liegen in der
     Reihenfolge, in der UC.buildLineDatasets sie gebaut hat, und __id ist die einzige Stelle, an
     der die Marke steht. Ein Zuordnen ueber die Position haette die Werte von Acme auf die Linie
     von BMW geschrieben. */
  function chartWandern(root, serie, dauer){
    var leinwand = root.querySelector(".up-line-canvas");
    if (!leinwand || !window.Chart || !window.Chart.getChart) return false;
    var chart = window.Chart.getChart(leinwand);
    if (!chart || !chart.data || !chart.data.datasets) return false;
    var nach = {};
    serie.forEach(function(p){
      (nach[p.company_id] || (nach[p.company_id] = [])).push(p.visibility_pct);
    });
    var etwas = false;
    chart.data.datasets.forEach(function(d){
      var neu = nach[d.__id];
      if (!neu || !d.data || neu.length !== d.data.length) return;
      d.data = neu.slice();
      etwas = true;
    });
    if (!etwas) return false;
    /* Dauer und Kurve der Linienbewegung auf die der Zeilen gestellt. Das Kit steht auf 600ms
       easeOutQuart -- das ist die EINGANGSanimation, und die soll so bleiben; hier wird nur diese
       eine Instanz umgestellt, und zwar erst jetzt, lange nach dem Eingang. */
    if (chart.options && chart.options.animation){
      chart.options.animation.duration = dauer;
      chart.options.animation.easing = "easeOutQuad";
    }
    /* chart.update() und danach SOFORT das Anstecken des Tooltips wieder. Beides ist noetig, und
       beides aus einem gemessenen Grund:
       - chart.update() raeumt die aktiven Punkte ab, der Tooltip geht auf opacity 0 und
         VERSCHWINDET fuer die Dauer der Animation. Genau so war es: er war die ganze Bewegung ueber
         weg und stand am Ende mit den neuen Zahlen wieder da.
       - Das Anstecken muss DANACH kommen und nicht davor. Chart.js merkt sich die Datenpunkte des
         Tooltips und rechnet sie nur neu, wenn die aktiven Elemente neu gesetzt werden. Mit dem
         Anstecken vor dem update zeigte tooltip.dataPoints die ganze Animation ueber die ALTEN
         Werte (36.2, 32.0, 25.5 ...), und core hatte damit keinen Anlass, den Kasten neu zu bauen.
       Die zwei update() in einem Durchgang kosten nichts: das erste hat noch kein Bild gezeichnet,
       also faengt das zweite die Animation an derselben Stelle wieder an.
       Chart.js interpoliert die geaenderte Datenreihe von sich aus. Die y-Achse bleibt, wie sie ist:
       ihr Maximum entsteht in build() aus dem hoechsten Wert mal 1.15, und der hoechste Wert des
       Zustands B liegt darunter -- gemessen 43.58 gegen 41.3, nichts wird abgeschnitten. */
    try { chart.update(); } catch (e){ return false; }
    tippZeigen(root);
    return true;
  }

  function szene(root){
    if (zustand !== "a") return false;
    var kern = window.UpstreemCore;
    if (!kern) return false;
    var alt = {}, neu = {}, ordnung = [];
    tabelle("a").forEach(function(r){ alt[r.company_id] = r; });
    tabelle("b").forEach(function(r){ neu[r.company_id] = r; ordnung.push(r.company_id); });

    var werk = zaehlwerk(SZENE_DAUER);
    /* VOR dem Datentausch aufnehmen: danach hat core den Kasten schon mit den Endwerten neu
       gebaut, und die Ausgangslage waere nicht mehr zu erfahren. */
    var tipp = tippAufnehmen(root);

    /* Die sechs Zeilen: sechs Zahlen und ein Farbpunkt je Zeile. forEach und keine for-Schleife --
       Farbpunkt und Platzziffer brauchen einen Abschluss ueber die Zeile, und mit var haette der
       die LETZTE Zeile festgehalten. */
    [].slice.call(root.querySelectorAll(".vot-unit-right .vt-row")).forEach(function(z){
      var id = z.getAttribute("data-id"), a = alt[id], b = neu[id];
      if (!a || !b) return;
      werk.zahl(z.querySelector(".vt-td-visibility .up-num"), a.visibility_pct, b.visibility_pct, proz);
      werk.zahl(trendText(z.querySelector(".vt-td-visibility .up-trend")),
                Math.abs(a.visibility_delta_pct), Math.abs(b.visibility_delta_pct), ganzProz);
      werk.zahl(z.querySelector(".vt-td-ranking .up-num"), a.avg_rank, b.avg_rank, eine);
      werk.zahl(trendText(z.querySelector(".vt-td-ranking .up-trend")),
                Math.abs(a.avg_rank_delta), Math.abs(b.avg_rank_delta), eine);
      werk.zahl(z.querySelector(".vt-td-sentiment .up-sent-val"), a.sentiment, b.sentiment, ganz);
      werk.zahl(trendText(z.querySelector(".vt-td-sentiment .up-trend")),
                Math.abs(a.sentiment_delta), Math.abs(b.sentiment_delta), eine);
      /* Der Punkt vor der Sentiment-Note faerbt sich nach der Note (UC.sentColor, Stufen bei 25,
         40, 60 und 75). Acme geht von 74 auf 79 und BMW von 76 auf 75 -- beide ueberschreiten
         die 75. Aus dem laufenden Wert gerechnet und nicht am Ende gesetzt: so wechselt die Farbe
         genau in dem Augenblick, in dem die Zahl die Stufe erreicht. */
      var punkt = z.querySelector(".vt-td-sentiment .up-sent-dot");
      if (punkt) werk.frei(function(e){
        punkt.style.background = kern.sentColor(a.sentiment + (b.sentiment - a.sentiment) * e);
      });
      /* Die Platzziffer ist eine Ordnungszahl -- eine 2.4 unterwegs waere ein Fehler und kein
         Zaehlen. Also springt sie, und zwar auf der halben Strecke der WANDERUNG: vorher stimmte
         sie zur alten Lage der Zeile, nachher zur neuen. t und nicht e -- die Kurve ist zur halben
         Zeit bei 75 Prozent, die Ziffer waere zu frueh gesprungen. */
      var idx = z.querySelector(".vt-td-idx");
      if (idx) werk.frei(function(e, t){
        var soll = String((t >= ZIFFER_BEI ? b : a).position);
        if (idx.textContent !== soll) idx.textContent = soll;
      });
    });

    /* Die Kennzahlen im Seitenkopf gehoeren Acme und nicht dem Ersten der Tabelle. Reihenfolge
       im Markup: Visibility, Ranking, Sentiment (dashboard-page-header.js, setKpis).
       Von Hand und nicht ueber setDashboardPageHeaderKpis: der Setter schreibt die Zeile als
       innerHTML neu, und dann springen die drei Zahlen statt zu zaehlen. */
    var kea = alt["ac"], keb = neu["ac"];
    var kpis = root.querySelectorAll(".dph-kpis .dph-kpi");
    if (kea && keb && kpis.length === 3){
      [ { wert: "visibility_pct", delta: "visibility_delta_pct", fw: ganzProz, fd: ganzProz },
        { wert: "avg_rank",       delta: "avg_rank_delta",       fw: eine,     fd: eine },
        { wert: "sentiment",      delta: "sentiment_delta",      fw: ganz,     fd: ganz }
      ].forEach(function(w, i){
        werk.zahl(kpis[i].querySelector(".dph-kpi-value"), kea[w.wert], keb[w.wert], w.fw);
        werk.zahl(trendText(kpis[i].querySelector(".up-trend")),
                  Math.abs(kea[w.delta]), Math.abs(keb[w.delta]), w.fd);
      });
    }

    zustand = "b";
    /* Die Linien wandern so lange wie die Zeilen daneben, nicht so lange wie die Zahlen zaehlen.
       Vorher lief das Chart auf SZENE_DAUER (930ms), waehrend die Tabelle nach 400 stand -- zwei
       Bewegungen, die im selben Augenblick beginnen und sichtbar verschieden lang dauern. */
    chartWandern(root, reihen("b"), WANDER_DAUER);
    reihenWandern(root, ordnung, WANDER_DAUER);
    tippNachziehen(tipp, werk, WANDER_DAUER);
    werk.lauf(function(){
      /* Danach den Tooltip wieder anstecken: chart.update() raeumt die gesetzten Punkte ab, und
         ohne diesen Griff stuende das Chart nach der Szene ohne den dauerhaft offenen Kasten da.
         Das baut ihn NICHT neu -- die Kennung im Kit haengt an den Rohwerten, und die stehen seit
         dem Tausch fest. Die gezaehlten Zahlen bleiben also stehen. */
      ohneTipps(root);
      tippZeigen(root);
    });
    return true;
  }

  /* ---------- Zweite Szene: Mira ---------------------------------------------------------- */

  /* Der Ablauf der Sektion, in Zahlen:
       0            das Fenster erscheint gestaffelt (CSS, ulhRise): Rahmen, Seitenkopf, dann die
                    vier Kaesten des Dashboards einzeln, jeder mit Kopf und Panel
       1970         das Erscheinen ist durch -- zuletzt endet der Textblock ueber dem Fenster
                    (ERSCHEINEN_MS, seit dem 01.10.)
       ~3200        der Filterwechsel im Dashboard (gegatet auf das fertige Chart)
       7410         das Dashboard blendet aus, halb so lang wie eine Erscheinensstufe
       7755         Mira kommt mit derselben Bewegung von unten herein
       +600         die Frage wird Zeichen fuer Zeichen getippt
       +2000        Mira denkt
       dann         die Antwort erscheint und tippt sich selbst
     Alles ueber Uhren und nicht ueber Scrollen: die Sektion steht am Seitenanfang und laeuft einmal
     durch. Ob spaeter der Scrollstand die Szenen treibt, ist Schritt 3 -- dann tauscht nur der
     Ausloeser, nicht der Ablauf. */
  /* Das Ende von STUFE 0 und 1 -- Textblock, Rahmen, Seitenkopf. Seit dem 01.10. endet der
     Textblock zuletzt: der zweite Knopf faengt bei 870ms an und rollt 1100ms aus, also 1970
     (landing-hero.css, STUFE 0). Der Seitenkopf ist bei 1170 + 620 = 1790 schon durch.
     is-entering faellt 190ms danach ab -- Reserve fuer einen Frame Verzug beim Klassenwechsel.
     Der INHALT der Dashboard-Seite haengt nicht an dieser Uhr, sondern an is-inhalt
     (inhaltZeigen) -- siehe landing-hero.css. */
  var ERSCHEINEN_MS = 1970;
  /* Die vier Kaesten der Dashboard-Seite: letzte Stufe 230ms Verzoegerung plus 620ms Lauf. */
  var INHALT_MS = 850;
  /* Mira kommt als EINE Stufe herein, nicht als vier -- also nur der Lauf, ohne Verzoegerungen. */
  var MIRA_RISE_MS = 690;
  var AUSBLENDEN_MS = 345;       /* halb so lang wie eine Erscheinensstufe */
  /* Wie lange ein Schritt STEHT, nachdem seine Bewegung durch ist -- fuer alle drei gleich.
     Der Wert kommt vom Dashboard und ist nicht gewaehlt: dort endet das Erscheinen bei 1410, der
     Filterwechsel laeuft bei ~3200 an und ist bei ~4130 durch, und ausgeblendet wird bei 7410.
     Bleiben 3280ms Stillstand. Genau die bekommen Mira und die Prompts-Liste jetzt auch.
     MIRA_WARTEN bleibt die Uhr fuer das Dashboard -- sie zaehlt ab dem Erscheinen und muss die
     Bewegung darin mit abdecken. */
  /* 3280 -> 6200 (24.09. angefordert). Der Endzustand von Mira soll zwei Sekunden laenger
     stehen, und die Prompts-Liste GENAU SO LANGE wie Mira -- deshalb bekommen beide dieselbe
     Zahl: PROMPTS_WARTEN ist die Ruhe nach Miras fertiger Antwort, STAND_MS die nach den
     eingelaufenen Zeilen der Liste. */
  var STAND_MS = 6200;
  /* DER TAKT DER GANZEN RUNDE (06.10. spaet angefordert: "der finale State bei Shopping und
     Product Detail soll etwas laenger stehen bleiben, aber alles im Gesamtzyklus synchronisieren").
     Bis dahin hatte jede Szene ihre eigene Standzeit (Detail 4.1s, Schublade 4.0s, Performance
     6.0s, Prompts 6.2s, Uebersicht vor dem Klick 2.0s, Brett vor dem Klick 2.4s). Jetzt zwei Zahlen
     fuer die ganze Runde:
       STAND_MS      so lange steht der ENDZUSTAND einer Szene nach ihrer letzten Bewegung --
                     Miras Antwort, die Prompts-Liste, das Product Detail, die offene Schublade,
                     jede der zwei Performance-Ansichten
       VOR_KLICK_MS  so lange steht ein ZWISCHENSTAND, bevor darin geklickt wird -- die
                     Shopping-Uebersicht vor dem Produkt, das Brett vor der Karte. Lang genug, um
                     die Liste zu lesen; kuerzer als ein Endzustand, weil die Szene weitergeht. */
  var VOR_KLICK_MS = 3200;
  var MIRA_WARTEN = 8000;        /* nach dem Ende des Erscheinens, Bewegung inbegriffen */
  var MIRA_FRAGE = "Create an AI Visibility Report for Q3 2026";
  var MIRA_ZEICHEN_MS = 34;      /* je Zeichen -- 43 Zeichen ergeben rund 1.5 Sekunden */
  /* Zwei Sekunden zwischen dem letzten Zeichen und dem Abschicken: die Frage soll gelesen werden
     koennen, bevor sie weg ist. */
  /* 1400 statt 2000: die Pause zwischen dem fertig getippten Satz und dem Klick auf Senden. Zwei
     Sekunden waren im Ablauf der Sektion die dritte Stelle, an der nichts passiert. */
  var MIRA_PAUSE_MS = 1400;
  var MIRA_DENKT_MS = 3000;
  /* So lange vor dem Ende des Ladens geht das Eingabefeld weg: 260ms Ausblenden plus ein Rest, in
     dem der Platz schon frei ist, wenn die Antwort anfaengt zu wachsen. */
  var KOMPOSER_WEG_VOR = 700;
  /* Die Zeit, die unter der Antwort steht. Sie hat NICHTS mit MIRA_DENKT_MS zu tun: das Denken im
     Schaustueck dauert drei Sekunden, ein echter Report ueber ein Quartal braucht ein Vielfaches
     davon, und die Zahl darunter soll die echte Groessenordnung nennen. */
  var MIRA_GEDACHT_MS = 24000;

  /* Ein Chip im Antworttext. Genau die Form, die Mira selbst schickt: ein span mit
     data-mira-entity-type und einer Kennung. decorateEntitySpans in ask-mira.js setzt daraus den
     Chip mit Logo -- wir bauen den Chip also NICHT nach, wir liefern nur die Rohform, die die
     Komponente ohnehin erwartet. data-mira-entity-id fuer alle Typen, weil die Aufloesung dieses
     Feld als erstes probiert; die typspezifischen Namen (company_id und so weiter) braucht es
     dadurch nicht. */
  function miraChip(art, id, text){
    return '<span data-mira-entity-type="' + art + '" data-mira-entity-id="' + id + '">' +
           text + '</span>';
  }
  function markeChip(id){
    var m = MARKEN.filter(function(x){ return x.id === id; })[0];
    if (!m) return "";
    /* Die eigene Marke ist "brand", jede andere "competitor". Danach richtet sich der Chip: Farbe,
       Zeichen und die Beschriftung in der Datenpunktzeile (Your Brand gegen Competitor). */
    return miraChip(id === "ac" ? "brand" : "competitor", m.id, m.name);
  }

  /* Die zwei Quellen, auf die die Empfehlungen zeigen -- dieselben zwei, die auch im Zitatteil des
     Dashboards oben stehen, mit ihrem echten Zeichen (siehe quellzeichen). Die AUSSAGEN darueber
     sind ueber die eigene Marke formuliert und nicht ueber die Seite: "deine Preisseite wird dort
     nicht zitiert" ist eine Aussage ueber Acme, "die Seite verschweigt dich" waere eine ueber
     Reddit. */
  var MIRA_QUELLEN = [
    /* Kurze Pfade mit Absicht: der Chip zeigt Domain UND Pfad, und ein langer Pfad schiebt den
       Listenpunkt auf zwei Zeilen -- 26px, die im Fenster fehlen. */
    { id: "u1", domain: "forbes.com", pfad: "/luxury-ev-suv",
      titel: "The Best Luxury Electric SUVs You Can Buy In 2026" },
    { id: "u2", domain: "reddit.com", pfad: "/winterrange",
      titel: "Winter range thread" }
  ];
  function quelleChip(i){
    var q = MIRA_QUELLEN[i];
    return miraChip("url", q.id, q.domain + q.pfad);
  }

  /* Die Belegliste. Aus ihr zieht jeder Chip sein Logo, und aus ihren TYPEN baut Mira die Zeile mit
     den Datenpunkten unter der Antwort: brand -> Your Brand, competitor -> Competitor, url -> URL,
     response -> Response. Alle vier stehen deshalb drin, und jeder wird im Text auch wirklich
     genannt -- eine Marke in der Zeile, die im Text nicht vorkommt, waere eine Behauptung ueber
     Daten, die die Antwort nicht benutzt. */
  function miraBelege(){
    var aus = MARKEN.map(function(m){
      return { id: "ev-" + m.id, type: m.id === "ac" ? "brand" : "competitor",
               entity_id: m.id, company_id: m.id, company_name: m.name, title: m.name,
               icon_url: m.logo, action: m.id === "ac" ? "open_brand" : "open_competitor" };
    });
    MIRA_QUELLEN.forEach(function(q){
      aus.push({ id: "ev-" + q.id, type: "url", entity_id: q.id, title: q.titel,
                 url: "https://" + q.domain + q.pfad, entity_url: "https://" + q.domain + q.pfad,
                 domain: q.domain, icon_url: quellzeichen(q.domain),
                 action: "open_url" });
    });
    /* Das Zeichen des MODELLS und kein gemaltes Kaestchen: ChatGPT hat eines, und es steht
       ohnehin schon in den Antwortkarten weiter unten (quellzeichen("openai.com")). Der frueher
       hier gebaute gruene Buchstabe war der Rueckfall aus der Zeit der erfundenen Marken. */
    aus.push({ id: "ev-r1", type: "response", entity_id: "r1",
               title: "Which premium electric SUV should I buy?", subtitle: "chatgpt",
               prompt_run_id: "r1", action: "open_response",
               icon_url: quellzeichen("openai.com") });
    return aus;
  }

  /* Erwaehnungen je Marke. Aus der Visibility gerechnet und nicht erfunden: 106 Nennungen je
     Prozentpunkt ergibt Zahlen in der Groessenordnung der 15899 Zitate aus dem Dashboard, und sie
     passen zur Reihenfolge der Tabelle. Bei jedem Laden dieselben. */
  function miraNennungen(vis){
    var n = Math.round(vis * 106);
    return String(n).replace(/\B(?=(\d{3})+$)/g, ",");
  }

  /* Die Antwort. Aufbau wie in der App: Tabelle oben, zwei Absaetze Deutung darunter, dann eine
     Ueberschrift und die Empfehlungen.
     VIER Zeilen in der Tabelle und nicht sechs -- die Antwort soll ohne Scrollen in das Fenster
     passen, und die unteren zwei Marken tragen zur Aussage nichts bei.
     Nur Elemente, die der Sanitizer von Mira durchlaesst (h3, h4, p, ul, li, strong, em, table,
     span mit data-mira-*). Ein img waere hier zwecklos, er faellt raus; die Logos kommen ueber die
     Chips. Die Zahlen kommen aus demselben Zustand B, in den der Filterwechsel das Dashboard
     gebracht hat: eine Antwort mit anderen Zahlen als das Fenster darueber waere der auffaelligste
     Widerspruch, den diese Sektion haben koennte. */
  /* DREI STATT VIER (24.09. angefordert: "entferne eine Tabellen-Row, damit man diesmal wirklich
     die Evidence-Chips unten und die Buttons sieht"). Eine Zeile ist rund 38px -- zusammen mit dem
     kleineren Polster oben (landing-hero.css) reicht der Ausschnitt jetzt bis unter die Knopfreihe. */
  var MIRA_ZEILEN = 3;

  function miraAntwort(){
    var tab = tabelle("b");
    var zeilen = tab.slice(0, MIRA_ZEILEN).map(function(r){
      return '<tr><td>' + markeChip(r.company_id) + '</td>' +
             '<td>' + r.visibility_pct.toFixed(1) + '%</td>' +
             /* Das # vor dem Rang, in der dritten Textfarbe -- wie in der Rangspalte des
                Dashboards. em ist der Haken dafuer, siehe landing-hero.css. */
             '<td><em>#</em> ' + r.avg_rank.toFixed(1) + '</td>' +
             '<td>' + r.sentiment + '</td>' +
             '<td>' + miraNennungen(r.visibility_pct) + '</td></tr>';
    }).join("");
    var ke = tab.filter(function(r){ return r.company_id === "ac"; })[0];
    return '<h3>AI Visibility Report, Q3 2026</h3>' +
      '<table><thead><tr><th>Brand</th><th>Visibility</th><th>Rank</th><th>Sentiment</th>' +
      '<th>Mentions</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
      /* ZWEI Zeilen Deutung, nicht zwei Absaetze, und danach drei kurze Empfehlungen. Der Grund ist
         gemessen: die Antwort muss ohne Scrollen in das Fenster passen, und mit fuenf Zeilen Prosa
         plus vier zweizeiligen Punkten waren es 340px zu viel. Kuerzer ist hier auch besser: eine
         Antwort, die man im Vorbeigehen liest, hat drei Punkte und nicht sieben. */
      '<p>' + markeChip("ac") + ' closed the quarter first, ahead of ' + markeChip("bm") + ' and ' +
      markeChip("au") + ': visibility ' + ke.visibility_pct.toFixed(1) + '%, rank ' +
      ke.avg_rank.toFixed(1) + ', sentiment ' + ke.sentiment + '. Editorial sources carry ' +
      '<strong>31.4%</strong> of every citation, your own pages 9.3%.</p>' +
      '<h4>What to do next</h4><ul>' +
      '<li>' + quelleChip(0) + ' names ' + markeChip("bm") + ' in every comparison answer, never you.</li>' +
      '<li>' + quelleChip(1) + ' puts ' + markeChip("au") + ' above you on all five range prompts.</li>' +
      '<li>' + miraChip("response", "r1", "This response") + ' lists four competitors and leaves you out.</li>' +
      '</ul>';
  }

  function miraNachrichten(){
    var jetzt = new Date().toISOString();
    return [
      { id: "lh-m1", role: "user", content: MIRA_FRAGE, created_at: jetzt },
      { id: "lh-m2", role: "assistant", status: "success", created_at: jetzt,
        content_html: miraAntwort(), evidence_items: miraBelege(),
        latency_ms: MIRA_GEDACHT_MS }
    ];
  }

  /* Die Frage Zeichen fuer Zeichen ins Eingabefeld. Mit einem input-Ereignis je Zeichen, und das
     ist kein Beiwerk: daran haengen in Mira das Mitwachsen des Feldes, der Sendeknopf und die
     laufende Platzhalterzeile. Ohne das Ereignis stuende Text in einem Feld, das nicht mitwaechst,
     neben einem grauen Knopf -- es saehe aus wie Text, den niemand abschicken kann.
     KEIN focus und keine Tastenereignisse: die Buehne schluckt beides in der Einfangphase
     (nurSchauen), und das Feld braucht sie auch nicht -- der Wert wird direkt gesetzt. */
  function miraTippen(root, fertig){
    var ta = root.querySelector("#am-textarea");
    if (!ta){ if (fertig) fertig(); return; }
    /* Der Fokusrahmen, solange getippt wird. In der App entsteht er ueber :focus-within; hier wird
       nie etwas fokussiert, weil die Buehne focusin schluckt -- also die Klasse, und die CSS macht
       daraus einen halb so kraeftigen Ring. */
    var komposer = root.querySelector(".am-composer");
    if (komposer) komposer.classList.add("is-tippt");
    var i = 0;
    (function schritt(){
      ta.value = MIRA_FRAGE.slice(0, ++i);
      try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e){}
      if (i < MIRA_FRAGE.length) setTimeout(schritt, MIRA_ZEICHEN_MS);
      else setTimeout(function(){ miraKlick(root, fertig); }, MIRA_PAUSE_MS);
    })();
  }

  /* Der Klick auf den Sendeknopf. Es gibt keinen Zeiger im Bild, aber die BEWEGUNG eines Klicks:
     der Knopf nimmt die Hoverfarbe an, geht kurz auf 90 Prozent und federt zurueck -- und erst
     danach geht die Nachricht raus. Ohne das erschien die Frage aus dem Nichts im Chat, obwohl der
     Knopf daneben unberuehrt dastand.
     KLICK_AB ist die Zeit, die der Knopf gedrueckt bleibt; KLICK_NACH die kurze Ruhe danach, damit
     man das Zurueckfedern noch sieht, bevor sich alles bewegt. */
  var KLICK_AB = 130, KLICK_NACH = 110;

  function miraKlick(root, fertig){
    var knopf = root.querySelector("#am-send");
    if (!knopf){ if (fertig) fertig(); return; }
    knopf.classList.add("is-klick");
    setTimeout(function(){
      knopf.classList.remove("is-klick");
      setTimeout(function(){ if (fertig) fertig(); }, KLICK_NACH);
    }, KLICK_AB);
  }

  /* EIN FEHLER IN DEN DEMODATEN DARF NICHT DIE GANZE SEKTION ANHALTEN (21.09.).
     Genau das ist passiert: miraAntwort() griff nach dem Umbau auf die Marken auf eine Kennung
     zu, die es nicht mehr gab ("ke"), warf einen TypeError, und damit endete die Kette genau
     hier -- die Frage stand im Feld, es ging nicht weiter, und alle Szenen danach blieben im
     Skelett. Von aussen sah das aus, als waere die halbe Landingpage kaputt; die Ursache war ein
     falscher Schluessel in EINER Zeichenkette.
     Die Nachrichten werden deshalb in einem try gebaut. Faellt es aus, geht die Sektion trotzdem
     weiter -- und die Konsole sagt DEUTLICH, was fehlt, statt dass jemand die Ursache in der
     Animation sucht. Stilles Weitergehen waere hier falsch: ein leerer Chat ist ein sichtbarer
     Mangel, der jemandem auffallen muss. */
  function miraSenden(root){
    var m;
    try { m = miraNachrichten(); }
    catch (e){
      if (window.console) console.error("[landing-hero] Die Demodaten der Mira-Antwort liessen " +
        "sich nicht bauen -- die Sektion laeuft ohne Chat weiter. Fast immer eine Markenkennung, " +
        "die es in MARKEN nicht (mehr) gibt.", e);
      promptsAnsetzen(root);
      return;
    }
    var ta = root.querySelector("#am-textarea");
    /* Der aktive Chat MUSS gesetzt sein, bevor die erste Nachricht kommt. Ohne ihn faellt Mira nach
       140ms auf den Startbildschirm zurueck (_maybeHomeIfUnknownChat) -- eine abgeschickte Frage,
       die kurz aufblitzt und dann verschwindet. Gemessen, als der Aufruf noch fehlte. */
    /* Der Titel oben links kommt NICHT aus einem eigenen Setter: Mira sucht den aktiven Chat in der
       Liste der frueheren Chats und nimmt dessen title (renderChatTitlebar in ask-mira.js). Ohne
       diese Liste blieb dort das Ladeskelett stehen. titlePending muss dazu aus, sonst zeigt die
       Zeile weiter den Lader -- auch mit vorhandenem Titel. */
    /* DER TITEL KOMMT SPAETER UND WIRD GETIPPT (24.09. angefordert: "wenn der Titel reinkommt in
       die Topbar, mach das auch mit der Typeanimation wie in der Hauptapp").
       Also erst OHNE Namen in die Liste: die Kopfzeile zeigt dann ihr Skelett, genau wie in der
       App, solange ein Titel entsteht. Mit der Antwort kommt der Name und schreibt sich Zeichen
       fuer Zeichen (miraTitelTippen, unten im selben Ablauf). */
    if (window.askMiraSetPreviousChats) window.askMiraSetPreviousChats([
      { id: "lh-chat", title: "", updated_at: new Date().toISOString() }
    ]);
    if (window.askMiraSetTitlePending) window.askMiraSetTitlePending("yes");
    /* Die Quellen-Chips sollen ihr Zeichen zeigen und nicht das allgemeine Kettensymbol: die
       Voreinstellung fuer Zitate ist "icon", hier "favicon". Marke und Antwort stehen ohnehin auf
       logo, werden aber mitgegeben, damit die drei Werte an einer Stelle stehen. */
    if (window.askMiraSetSettings) window.askMiraSetSettings(
      { brand: "logo", citation: "favicon", response: "logo" });
    if (window.askMiraSetActiveChat) window.askMiraSetActiveChat("lh-chat");
    /* Der Fokusrahmen faellt mit dem Abschicken ab, wie in der App beim Verlassen des Feldes. */
    var komposer = root.querySelector(".am-composer");
    if (komposer) komposer.classList.remove("is-tippt");
    if (ta){
      ta.value = "";
      try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e){}
    }
    if (window.askMiraSetMessages) window.askMiraSetMessages([m[0]]);
    /* Das Ausblenden des Eingabefelds MUSS hier stehen und nicht in einer Regel. Mira schaltet beim
       ersten Satz auf has-messages und faehrt das Feld per FLIP nach unten: sie schreibt dabei
       transition: none und danach transform 200ms als INLINE-Stil an dieses Element und raeumt ihn
       erst nach 240ms weg. Eine Regel fuer die Deckkraft verliert gegen diesen Inline-Stil -- das
       Feld waere ohne Ueberblendung verschwunden, mitten in der Fahrt.
       Also die eigene Ueberblendung an denselben Inline-Stil anhaengen, ein Bild spaeter, wenn
       Miras Schreibvorgang durch ist. 95ms Verzoegerung auf 110ms Lauf gegen eine Fahrt von 200:
       die erste Haelfte sieht man ganz, und unten angekommen IST es weg. Vorher endete das
       Ausblenden bei 310ms, also nach der Fahrt -- dann sieht man das Feld unten ankommen und erst
       danach verschwinden, und die Fahrt selbst geht in dem Verschwinden unter. */
    /* Das Eingabefeld faehrt nach unten -- die Fahrt ist MIRAS eigene (FLIP in setHasMessages,
       200ms), und sie ist gemessen: 289px, von 400 auf 689. Hier passiert nur das Ausblenden, und
       zwar SPAETER.
       Vorher lag es auf der Fahrt (95ms Verzoegerung, 110ms Lauf): das Feld war bei 205ms weg,
       also bevor es unten ankam -- deshalb war von der Fahrt nichts zu sehen. Jetzt bleibt es die
       ganze Fahrt UND die Ladezeit ueber stehen, genau wie in der App, wo man beim Warten weiter
       auf sein Eingabefeld schaut. Weg muss es trotzdem: es nimmt 125px, und die braucht die
       Antwort samt Datenpunktzeile und Knopfreihe, damit sie in den Ausschnitt passt. Also kurz
       vor der Antwort, mit dem Uebergang aus der CSS (opacity 260ms). */
    var flaeche = root.querySelector(".am-composer-area");
    if (flaeche) setTimeout(function(){
      flaeche.style.opacity = "0";
      setTimeout(function(){ flaeche.style.display = "none"; }, 300);
    }, Math.max(0, MIRA_DENKT_MS - KOMPOSER_WEG_VOR));
    /* Erst die Nachricht, dann das Laden: askMiraSetMessages stellt den Ladezustand selbst auf den
       Stand der Liste, und der ist bei einer reinen Nutzerfrage "nicht am Laden". */
    if (window.askMiraSetBrandLogos) window.askMiraSetBrandLogos(MARKEN.map(function(b){
      return { logo_url: b.logo, name: b.name };
    }));
    if (window.askMiraSetLoading) window.askMiraSetLoading("true");
    /* brand_overview ist der Werkzeugname, den Mira fuer genau diese Frage melden wuerde: er fuehrt
       auf den Markenlader mit den Logos statt auf die drei Punkte. */
    if (window.askMiraSetTool) window.askMiraSetTool("brand_overview");
    setTimeout(function(){
      /* expectAnswer VOR dem Nachladen, typeLastAnswer danach -- das ist der vorgesehene Weg, wenn
         eine Antwort per kompletter Liste kommt (ask-mira.js: die Komponente kann eine neue Antwort
         sonst nicht von einem geoeffneten Chat unterscheiden und tippt nichts). */
      if (window.askMiraExpectAnswer) window.askMiraExpectAnswer();
      if (window.askMiraSetMessages) window.askMiraSetMessages(m);
      if (window.askMiraTypeLastAnswer) window.askMiraTypeLastAnswer();
      miraTitelSetzen(root);
      hellHalten(root);
      ohneTipps(root);
      miraZeilenAnsetzen(root);
    }, MIRA_DENKT_MS);
  }

  /* ---- DER CHATTITEL SCHREIBT SICH IN DIE KOPFZEILE -------------------------------------------
     In der App tippt sich der Titel in die ZEILE DER SEITENLEISTE (titelAustippen in ask-mira.js).
     Auf der Landingpage ist die grosse Chatliste zu -- zu sehen ist nur die Kopfzeile, und dort
     soll dieselbe Bewegung passieren.
     Warum hier und nicht ueber die Komponente: Miras Tippen haengt an der Zeile in der Liste, und
     die gibt es hier nicht. Die Kopfzeile schreibt ihren Text in einem Zug (renderChatTitlebar).
     Also wird der Titel ganz normal gesetzt -- Liste, titlePending, aktiver Chat, alles ueber die
     vorgesehenen Setzer -- und danach der Text der Kopfzeile ueberschrieben, Zeichen fuer Zeichen.
     Waehrend der Szene zeichnet nichts die Kopfzeile neu; der letzte Schreiber gewinnt.
     Dasselbe Tempo wie die getippte Frage darueber (34ms je Zeichen). */
  var MIRA_TITEL = "AI Visibility Report Q3 2026";
  function miraTitelSetzen(root){
    if (window.askMiraSetPreviousChats) window.askMiraSetPreviousChats([
      { id: "lh-chat", title: MIRA_TITEL, updated_at: new Date().toISOString() }
    ]);
    if (window.askMiraSetTitlePending) window.askMiraSetTitlePending("no");
    if (window.askMiraSetActiveChat) window.askMiraSetActiveChat("lh-chat");
    var el = root.querySelector("#am-ct-text");
    if (!el) return;
    var i = 0;
    (function tick(){
      if (!el.isConnected) return;
      el.textContent = MIRA_TITEL.slice(0, ++i);
      if (i < MIRA_TITEL.length) setTimeout(tick, MIRA_ZEICHEN_MS);
    })();
  }

  /* Die Zeilen der Antworttabelle kommen einzeln herein, wie die der Prompts-Liste.
     Angesetzt wird, sobald Mira den Tabellenblock FREIGIBT und nicht sobald die Zeilen im DOM
     stehen: das Tippen laesst den Block erst mit display: none stehen und setzt dann .on -- vorher
     gestaffelt waere die Bewegung hinter einem unsichtbaren Block abgelaufen und niemand haette
     sie gesehen. */
  function miraZeilenAnsetzen(root){
    var seite = root.querySelector(".ulh-mira");
    if (!seite) return;
    var n = 0;
    (function warten(){
      var block = root.querySelector(".am-msg.is-assistant .am-table-scroll.on");
      var zeilen = block ? block.querySelectorAll("tbody tr") : null;
      if (zeilen && zeilen.length){
        for (var i = 0; i < zeilen.length; i++) zeilen[i].style.setProperty("--ulh-i", i);
        seite.classList.add("is-zeilen");
        setTimeout(function(){
          seite.classList.remove("is-zeilen");
          for (var j = 0; j < zeilen.length; j++) zeilen[j].style.removeProperty("--ulh-i");
        }, 320 + zeilen.length * 60 + 200);
        return;
      }
      /* Zwei Minuten Geduld: in einem verdeckten Tab sind alle Uhren auf eine Sekunde gedrosselt,
         und das Tippen der Antwort braucht dort ein Vielfaches seiner Zeit. */
      if (++n < 900) setTimeout(warten, 60);
    })();
  }

  function miraSzene(root){
    var dash = root.querySelector(".ulh-main");
    var mira = root.querySelector(".ulh-mira");
    if (!dash || !mira || mira.__ulhMiraAuf) return false;
    mira.__ulhMiraAuf = true;
    dash.classList.add("is-weg");
    /* Der Punkt in der Leiste wandert mit. Ohne ihn stuende Mira im Fenster, waehrend die Leiste
       weiter das Dashboard als aktiv zeigt -- der Widerspruch, an dem man sofort sieht, dass es
       ein zusammengesetztes Bild ist. */
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "mira");
    setTimeout(function(){
      /* is-weg mit abnehmen: es schlaegt is-da (spaeter in der CSS), und im Kreislauf kann es
         von der Runde davor noch stehen. */
      mira.classList.remove("is-weg");
      mira.classList.add("is-da");
      mira.classList.add("is-kommt");
      setTimeout(function(){ mira.classList.remove("is-kommt"); }, MIRA_RISE_MS + 120);
      hellHalten(root);
      ohneTipps(root);
      /* Erst tippen, wenn Mira STEHT. Vorher lief beides gleichzeitig -- gemessen fing die Frage
         bei 360ms an, waehrend die Seite noch bis 1035ms heraufzog. Zwei Bewegungen uebereinander
         lesen sich als eine unruhige. */
      setTimeout(function(){
        miraTippen(root, function(){ miraSenden(root); });
      }, MIRA_RISE_MS);
      promptsAnsetzen(root);
    }, AUSBLENDEN_MS);
    return true;
  }

  /* Sobald die Seite bewegt wird, geht das Fenster auf seinen kleinen Zustand zurueck (hoechstens
     1300px breit, siehe kleinFaktor); oben angekommen wird es wieder gross.

     Der Faktor steht als INLINE-Stil am Rahmen und nicht in einer Regel mit Klasse. Zwei Gruende,
     beide aus Fehlversuchen:
     - Auf demselben Element laeuft beim Erscheinen eine CSS-animation, und eine laufende animation
       schlaegt jede Regel. Ein Inline-Stil verliert dagegen nur SOLANGE sie laeuft und greift danach
       von sich aus -- der Takt unten schreibt ihn ohnehin jedes Mal nachdrucklos nach.
     - Es gibt keine Regel mehr, deren Spezifitaet oder Reihenfolge jemand versehentlich schlagen
       kann. Die Klasse .is-klein bleibt als Zustandsmerkmal fuer alles, was spaeter dazukommt.

     ERKANNT wird die Bewegung auf vier Wegen, in dieser Reihenfolge, weil jeder einzelne auf
     irgendeiner Seite ausfaellt:
     1. window.scrollY -- der Normalfall.
     2. Die LAGE der Sektion im eigenen Dokument. Faengt jeden eigenen Scrollkasten und auch die
        Baukaesten, die den Seiteninhalt per transform verschieben, statt zu scrollen: dort feuert
        kein scroll-Ereignis und window.scrollY bleibt 0.
     3. Die Lage des RAHMENS, in dem die Sektion steckt (window.frameElement). Framer haengt ein
        HTML-Embed in einen eigenen Rahmen; darin bewegt sich weder das Fenster noch die Lage der
        Sektion, wenn die Seite darueber scrollt -- wohl aber der Rahmen selbst.
     4. Die Scrollposition der Fenster darueber, bis zu vier Ebenen hoch.
     3 und 4 koennen bei fremder Herkunft werfen; dann bleibt es bei 1 und 2. */
  /* Der grosse Zustand ist scale(1): wie breit das Hauptfenster dann ist, sagt allein die Spur in
     landing-hero.css (Rand und Deckel) -- und mit ihm stehen die beiden Schienen und der Inhalt
     jeder Sektion. Der erste Versuch hatte nur das Fenster ueber ein transform verkleinert, die
     Schienen blieben stehen, und dazwischen klaffte je Seite der Rand.

     DER KLEINE ZUSTAND IST EIN DECKEL UND KEIN FESTER ANTEIL MEHR (28.09. angefordert: "in der
     kleiner-werden Form bitte ne max width von 1300px ... aber halt maxwidth, also bei kleiner
     pagewidth schoen runterskalieren").
     Der Faktor ist das Verhaeltnis der zwei Deckel aus landing-hero.css (--ulh-deckel-klein zu
     --ulh-deckel, 1300 / 1440 = 0.9028). Steht das grosse Fenster an seinem Deckel, wird das
     kleine damit genau 1300 breit. Ist die Seite schmaler, ist schon das grosse Fenster schmaler,
     und das kleine geht im selben Verhaeltnis mit -- die Bewegung beim Scrollen ist auf jeder
     Breite dieselbe, nur ihr Massstab nicht. Gelesen und nicht hingeschrieben: die zwei Zahlen
     stehen in der CSS, und eine zweite Wahrheit hier waere beim naechsten Wert daneben.
     Bis dahin standen hier 0.76 der Spur samt Rand, auf breiten Seiten also rund 1094px -- die
     Verkleinerung sollte vor allem den drei Nebenfenstern Platz machen, die direkt neben dem
     Hauptfenster stehen. Mit dem groesseren kleinen Zustand bekamen sie weniger davon und liefen
     aus der Seite hinaus.
     DAS IST SEIT DEM 28.09. NICHT MEHR SO: der Deckel-Faktor ist nur noch die OBERGRENZE. Passen
     die Nebenfenster daneben nicht in die Seite, rechnet einpassen() einen kleineren Faktor --
     erst rueckt jedes Fenster ein Stueck auf das Hauptfenster zu, dann wird die ganze Buehne
     kleiner. kleinFaktor ist das Kleinere aus beidem; der Deckel allein steht in deckelFaktor,
     weil einpassen() ihn als Anfang seiner Rechnung braucht. */
  /* Bis zu dieser Seitenbreite sind die drei Nebenfenster aus und die Buehne wird nicht
     verkleinert -- dieselbe Zahl wie die Medienabfrage in landing-hero.css ("DIE NEBENFENSTER GEHEN
     AB 1200px"). Stehen die zwei verschieden, gibt es einen Bereich ohne Nebenfenster, in dem die
     Buehne trotzdem schrumpft, oder einen mit Nebenfenstern, die ueber den Rand ragen. */
  var NEBENFENSTER_BIS = 1200;
  function deckelFaktor(root){
    var cs = getComputedStyle(root);
    var gross = parseFloat(cs.getPropertyValue("--ulh-deckel")) || 1440;
    var klein = parseFloat(cs.getPropertyValue("--ulh-deckel-klein")) || 1300;
    return Math.min(1, klein / gross);                    /* nie hochskalieren */
  }
  function kleinFaktor(root){
    var d = deckelFaktor(root), e = root.__ulhEinpassung;
    return e ? Math.min(d, e.faktor) : d;
  }

  function scrollGroesse(root){
    if (root.__ulhScrollAn) return;
    root.__ulhScrollAn = true;
    var ruhe = null, ruheRahmen = null;

    function bewegt(){
      var y = 0;
      try { y = window.scrollY || window.pageYOffset || 0; } catch (e){}
      if (y > 1) return true;

      var oben = root.getBoundingClientRect().top;
      /* Die Ruhelage ist das Maximum aller je gemessenen Oberkanten: scrollen kann die Sektion nur
         nach OBEN schieben, ein hoeherer Wert ist also immer der unbewegte Zustand. Das korrigiert
         sich auch selbst, wenn der Browser beim Laden eine alte Scrollposition wiederherstellt. */
      if (ruhe == null || oben > ruhe) ruhe = oben;
      if ((ruhe - oben) > 1) return true;

      try {
        var rahmen = window.frameElement;
        if (rahmen){
          var rt = rahmen.getBoundingClientRect().top;
          if (ruheRahmen == null || rt > ruheRahmen) ruheRahmen = rt;
          if ((ruheRahmen - rt) > 1) return true;
        }
      } catch (e){}

      try {
        var w = window;
        for (var i = 0; i < 4 && w.parent && w.parent !== w; i++){
          w = w.parent;
          if ((w.scrollY || w.pageYOffset || 0) > 1) return true;
        }
      } catch (e){}

      return false;
    }

    function anwenden(){
      /* Die Buehne und nicht das Fenster: an ihr haengen auch die drei Nebenfenster, und die
         muessen dieselbe Bewegung machen -- sonst wandern sie beim Scrollen relativ zum
         Hauptfenster. */
      var rahmen = root.querySelector(".ulh-buehne");
      if (!rahmen) return;
      var soll = bewegt();
      /* BEIDE Zustaende ausdruecklich, auch der grosse als scale(1) -- nicht der leere Wert. Eine
         Ueberblendung von "none" auf "scale(.8)" muss ein Browser als Uebergang von der Einheits-
         matrix lesen, und das ist genau die Stelle, an der es hakt, wenn etwas hakt. Zwischen zwei
         echten Transformationen gibt es nichts zu deuten. */
      /* Auf schmalen Schirmen wird NICHT verkleinert. Die Verkleinerung hat dort keinen Zweck
         mehr: sie macht Platz fuer die drei Nebenfenster, und die sind ab 900px ausgeblendet.
         Was bleibt, waere ein Fenster, das beim Scrollen schrumpft und dessen Schrift dabei
         unlesbar wird -- auf einem Telefon zaehlt jedes Pixel Schriftgroesse.
         Die Schwelle ist die, ab der die Nebenfenster weg sind (NEBENFENSTER_BIS, 1200 seit dem
         29.09. spaet, vorher 900) -- dieselbe wie in der CSS; sie steht hier als Zahl, weil ein
         Stylesheet seine Medienabfragen nicht herausgibt. */
      var schmal = (window.innerWidth || document.documentElement.clientWidth || 0) <= NEBENFENSTER_BIS;
      var wunsch = (soll && !schmal) ? "scale(" + kleinFaktor(root).toFixed(4) + ")" : "scale(1)";
      /* Nur schreiben, wenn sich etwas aendert -- sonst waere das ein Stilschreiben je Takt, und
         jedes davon macht das Layout schmutzig. */
      if (rahmen.style.transform !== wunsch) rahmen.style.transform = wunsch;
      if (soll !== root.classList.contains("is-klein")){
        if (soll) root.classList.add("is-klein"); else root.classList.remove("is-klein");
      }
    }
    /* Fuer einpassen(): rechnet es einen neuen Faktor, soll er sofort am Rahmen stehen und nicht
       bis zum naechsten Takt warten (120ms, in denen ein Nebenfenster ueber den Rand ragen kann). */
    root.__ulhGroesseAnwenden = anwenden;

    /* Eine Handhabe zum NACHSEHEN, wie __ulhSzene und __ulhMira. Sie schreibt nichts und zeigt
       nichts an, sie GIBT den Stand zurueck: welcher der vier Wege anschlaegt, was am Rahmen steht
       und wie die Ruhelagen aussehen. Damit laesst sich auf einer fremden Seite in einer Zeile
       klaeren, ob die Erkennung ausfaellt oder etwas anderes -- ohne Rateschleife. */
    root.__ulhStand = function(){
      var rahmen = root.querySelector(".ulh-buehne");
      var eltern = [];
      try {
        var w = window;
        for (var i = 0; i < 4 && w.parent && w.parent !== w; i++){ w = w.parent; eltern.push(w.scrollY || w.pageYOffset || 0); }
      } catch (e){ eltern.push("fremde Herkunft"); }
      var rt = null;
      try { rt = window.frameElement ? Math.round(window.frameElement.getBoundingClientRect().top) : null; }
      catch (e){ rt = "fremde Herkunft"; }
      return {
        klein: root.classList.contains("is-klein"),
        transform: rahmen ? (rahmen.style.transform || "(leer)") : "kein Rahmen",
        gerechnet: rahmen ? getComputedStyle(rahmen).transform : null,
        scrollY: window.scrollY,
        oben: Math.round(root.getBoundingClientRect().top),
        ruhe: ruhe == null ? null : Math.round(ruhe),
        im_rahmen: rt, ruhe_rahmen: ruheRahmen == null ? null : Math.round(ruheRahmen),
        eltern_scroll: eltern,
        /* Faktor, Kante und Einrueckung je Nebenfenster aus einpassen() -- damit auf einer
           fremden Seite in einer Zeile zu sehen ist, ob die Einpassung gerechnet hat. */
        einpassung: root.__ulhEinpassung || null
      };
    };

    anwenden();
    /* Die Zuhoerer reagieren im Normalfall sofort. Der Takt daneben ist kein Guertel-und-
       Hosentraeger, sondern der eigentliche Weg fuer die Faelle 2 bis 4: dort kommt gar kein
       Ereignis an. Nachgemessen in diesem Aufbau -- window.scrollTo verschob die Seite und loeste
       NULL scroll-Ereignisse aus.
       120ms heisst ein Rechteck-Lesen je Achtelsekunde. Auf einer ruhenden Seite kostet das nichts:
       ohne Aenderung am DOM ist das Layout gueltig und der Wert liegt schon vor. Der Takt endet mit
       der Sektion. */
    window.addEventListener("scroll", anwenden, { passive: true });
    document.addEventListener("scroll", anwenden, { passive: true, capture: true });
    window.addEventListener("resize", function(){ ruhe = null; ruheRahmen = null; anwenden(); });
    var takt = setInterval(function(){
      if (!document.body || !document.body.contains(root)){ clearInterval(takt); return; }
      anwenden();
    }, 120);
  }

  /* Das Mausrad muss durch das Fenster hindurch an die Seite. Mira haengt einen eigenen
     Rad-Zuhoerer an ihren Chat, der die Bewegung uebernimmt und preventDefault ruft -- und zwar
     immer, wenn der Chat mehr Inhalt hat als Hoehe. Genau das ist hier der Fall: er ist nur
     ABGESCHNITTEN (overflow: hidden), nicht kuerzer. Ueber dem Chat liess sich die Seite deshalb
     nicht bewegen.
     Abgefangen wird in der EINFANGPHASE, bevor Miras Zuhoerer dran ist, und nur die Weitergabe
     gestoppt -- KEIN preventDefault. Dann tut der Browser, was er ohne jeden Zuhoerer tun wuerde:
     die Seite bewegen. */
  function radDurchlassen(root){
    var view = root.querySelector(".ulh-view");
    if (!view || view.__ulhRad) return;
    view.__ulhRad = true;
    ["wheel", "touchmove"].forEach(function(art){
      view.addEventListener(art, function(e){ e.stopPropagation(); }, true);
    });
  }

  /* ---------- Dritte Szene: die Prompts-Liste --------------------------------------------- */

  /* Die Themen. Farben aus derselben Familie wie die Markenfarben oben, damit die Sektion einen Ton
     hat und nicht zwei. hex_light und hex_dark, weil die Themenchips beide Themen kennen. */
  var THEMEN = [
    /* OHNE EMOJI (24.09., zum zweiten Mal angefordert). Die Chips tragen sie in der Prompts-Liste
       und in den Chancen; die Felder sind hier ganz weg statt leer, damit auch nichts mehr
       durchrutschen kann -- jede Stelle prueft auf t.emoji und laesst den Kasten dann aus. */
    { id: "t1", name: "Pricing",         hex_light: "#b3541e", hex_dark: "#e0a06a" },
    { id: "t2", name: "Comparisons",     hex_light: "#1f6feb", hex_dark: "#7aa9f0" },
    { id: "t3", name: "Electric",        hex_light: "#1a7f5a", hex_dark: "#6fc7a4" },
    { id: "t4", name: "Charging",        hex_light: "#8957e5", hex_dark: "#b79af0" },
    { id: "t5", name: "Fleet",           hex_light: "#0e7490", hex_dark: "#6bb6c9" },
    { id: "t6", name: "Safety",          hex_light: "#be185d", hex_dark: "#e78bb0" },
    { id: "t7", name: "Test Drive",      hex_light: "#6f737c", hex_dark: "#a8adb6" },
    /* Das achte Thema gibt es, seit die Matrix acht Zeilen zeigt. Es steht auch den anderen
       Vorschauen zur Verfuegung -- die nehmen sich ihre Themen vom Anfang der Liste. */
    { id: "t8", name: "Servicing",      hex_light: "#a16207", hex_dark: "#d9b45f" }
  ];

  /* Die eigenen Gruppierungen. NUR diese werden gezeigt (Modus "custom"), keine automatischen
     Themengruppen -- das war die Ansage. Sie stehen im localStorage, weil die Komponente sie dort
     erwartet: eine Gruppierung ist eine Einstellung des Nutzers, kein Datensatz vom Server. */
  /* anzahl ist die Zahl der Prompts im GANZEN Bestand, nicht in der gezeigten Seite -- so steht es
     auch in der App: die Gruppenkopfzeile zaehlt den gefilterten Bestand, die Liste darunter zeigt
     eine Seite davon. Die vier Zahlen sind der Anteil aus der Stichprobe unten, auf die 231 des
     Kontos hochgerechnet (11/11/13/5 von 40 -> 63/64/75/29). Dieselbe 231 nennt die Seitenleiste
     und die Kopfzeile der Tabelle -- drei verschiedene Zahlen fuer dieselbe Menge waeren der
     Widerspruch, den man in einer Sektion wie dieser zuerst bemerkt. */
  var GRUPPEN = [
    /* Gedeckte Toene und nicht die satten der Marken: die Punkte in der Gruppenliste sind
       Merkzeichen und keine Aussage. Es sind die Tableau-Farben, jeweils in Richtung Grau
       aufgehellt -- so bleiben sie eine Familie mit dem Chart. */
    { key: "Buying intent",  tag_ids: ["t1", "t2"], hex: "#8CA9C4", anzahl: 63 },
    { key: "Electric",       tag_ids: ["t3", "t4"], hex: "#9DC3A3", anzahl: 64 },
    { key: "Fleet & safety", tag_ids: ["t5", "t6"], hex: "#9FBFC2", anzahl: 75 },
    { key: "Dealership",     tag_ids: ["t7"],       hex: "#E0B384", anzahl: 29 }
  ];
  /* 231 Prompts im Konto, 15 auf der Seite -- die Seitengroesse der Tabelle steht auf 15, und eine
     Liste mit mehr Zeilen als die Fusszeile behauptet ist ein Widerspruch in derselben Ansicht.
     Gemessen: die Fusszeile sagte "1-15 of 26", gerendert waren 26. */
  var PROMPT_SEITE = 15;
  var PROMPT_BESTAND = 231;

  /* Die Prompts. Aufbau je Zeile: Text, Themen, Visibility, Rang, Sentiment, Zahl der Marken in der
     Antwort, Markt. Absichtlich verschieden lang -- die Zeilenhoehe steht auf "Dynamic", und eine
     Liste aus gleich langen Einzeilern wuerde das gar nicht zeigen. */
  /* Maerkte: ueberwiegend US, drei DE, kein UK mehr -- ein Konto verteilt seine Prompts nicht
     gleichmaessig ueber drei Laender, und die Spalte soll aussehen wie echte Daten. */
  var PROMPT_ROHDATEN = [
    ["Which premium electric SUV should I buy in 2026?", ["t3", "t2"], 41.2, 1.2, 81, 6, "US"],
    ["Best luxury EV for long distance driving", ["t3"], 38.4, 1.4, 79, 5, "US"],
    ["Was kostet ein Premium-SUV im Leasing pro Monat?", ["t1"], 34.9, 1.8, 76, 4, "DE"],
    ["Acme vs BMW vs Audi for a family car", ["t2", "t3"], 33.1, 2.0, 78, 6, "US"],
    ["Is there a plug-in hybrid with more than 100 km electric range?", ["t3", "t1"], 29.6, 2.4, 71, 3, "US"],
    ["Which luxury car works best with Tesla Superchargers?", ["t4", "t2"], 28.2, 2.5, 74, 5, "US"],
    ["Does it charge fast enough for a weekly commute?", ["t4"], 26.8, 2.7, 72, 4, "US"],
    ["Cheapest way into a premium SUV with all-wheel drive", ["t1", "t2"], 25.4, 2.9, 69, 6, "US"],
    ["Welche Ladeleistung hat ein Premium-E-SUV wirklich?", ["t4", "t3"], 24.1, 3.0, 73, 3, "DE"],
    ["What does a company car policy cost per driver per year?", ["t5"], 22.9, 3.2, 75, 4, "DE"],
    ["Fleet leasing for 200 cars with charging infrastructure", ["t5", "t1"], 21.7, 3.3, 70, 5, "US"],
    ["Which brand has the best Euro NCAP rating in its class?", ["t6"], 20.4, 3.5, 68, 4, "US"],
    ["How do I book a test drive without going to a dealer?", ["t7"], 19.8, 3.6, 77, 2, "US"],
    ["Ordering a car online, step by step", ["t7", "t2"], 18.6, 3.8, 76, 3, "US"],
    ["Do reviewers recommend the estate or the SUV?", ["t2", "t6"], 17.9, 4.0, 66, 6, "US"],
    ["Best executive car for a sales fleet in Germany", ["t5", "t2"], 16.8, 4.1, 69, 5, "US"],
    ["What is the real world range in winter?", ["t3", "t4"], 15.9, 4.3, 71, 3, "US"],
    ["Which SUV keeps its value best after three years?", ["t1", "t2"], 15.1, 4.4, 72, 4, "US"],
    ["Wie lange dauert die Lieferung eines Neuwagens?", ["t7"], 14.2, 4.6, 70, 2, "DE"],
    ["What is the difference between mild hybrid and plug-in hybrid?", ["t3"], 13.4, 4.8, 74, 3, "US"],
    ["Driver assistance systems compared across premium brands", ["t6", "t2"], 12.6, 5.0, 67, 5, "US"],
    ["Service costs for a premium SUV over five years", ["t8", "t1"], 11.8, 5.1, 65, 4, "US"],
    ["Which competitors come up when people search for an electric estate?", ["t2"], 11.1, 5.3, 68, 6, "US"],
    ["Gibt es eine Garantieverlaengerung fuer die Batterie?", ["t8", "t3"], 10.4, 5.5, 70, 4, "DE"],
    ["Checklist before collecting a new car", ["t7", "t8"], 9.6, 5.7, 72, 2, "US"],
    ["How often does an electric car need a workshop visit?", ["t8"], 8.9, 5.9, 71, 3, "US"]
  ];

  /* Die Marken in der Antwort. Aus MARKEN oben, damit dieselben Logos und Namen wie im Dashboard
     und in Miras Antwort stehen -- drei verschiedene Markenlisten in einer Sektion waeren der
     auffaelligste Bruch, den sie haben koennte. Wie viele, sagt die Zeile; angefuehrt wird von der
     eigenen Marke, sobald sie ueberhaupt vorkommt. */
  function promptMarken(anzahl, versatz){
    var aus = [];
    for (var i = 0; i < anzahl && i < MARKEN.length; i++){
      var m = MARKEN[(i + versatz) % MARKEN.length];
      /* Nennungen und Anteil aus dem Platz in der Liste gerechnet und nicht gewuerfelt: dasselbe
         Bild bei jedem Laden, und die Zahlen fallen von links nach rechts, wie man es erwartet. */
      var n = 480 - i * 74 - versatz * 9;
      aus.push({ name: m.name, favicon: m.logo, mention_count: n,
                 mentioned_pct: Math.round((n / 6.4)) / 10 });
    }
    return aus;
  }

  function promptZeilen(){
    return PROMPT_ROHDATEN.map(function(p, i){
      return {
        prompt_id: "p" + (i + 1),
        prompt_text: p[0],
        tags: p[1].map(function(id){ return THEMEN.filter(function(t){ return t.id === id; })[0]; }),
        visibility_pct: p[2],
        avg_rank: p[3],
        avg_sentiment_30d: p[4],
        top_mentions: promptMarken(p[5], i),
        companies_preview_totalcount: p[5],
        market: p[6],
        is_active: "yes"
      };
    });
  }

  /* Die Kopfzeilen der Gruppen. Die Kennzahlen sind der Durchschnitt der Prompts, die wirklich in
     der Gruppe stecken -- gerechnet und nicht gesetzt: eine Gruppe, deren Zahl nicht zu ihren
     Zeilen passt, ist genau die Art Widerspruch, die auffaellt, wenn jemand eine Gruppe aufklappt. */
  function gruppenZeilen(){
    var zeilen = promptZeilen();
    return GRUPPEN.map(function(g){
      var drin = zeilen.filter(function(z){
        return z.tags.some(function(t){ return t && g.tag_ids.indexOf(t.id) >= 0; });
      });
      function mittel(feld){
        if (!drin.length) return null;
        var s = 0;
        drin.forEach(function(z){ s += z[feld]; });
        return Math.round((s / drin.length) * 10) / 10;
      }
      return {
        group_key: g.key, is_custom: "yes", is_untagged: "no",
        prompts_count: g.anzahl,
        visibility_pct: mittel("visibility_pct"),
        avg_rank: mittel("avg_rank"),
        avg_sentiment: Math.round(mittel("avg_sentiment_30d"))
      };
    });
  }

  /* Die Einstellungen der Tabelle stehen im localStorage, weil es SEINE Einstellungen sind -- die
     Komponente liest sie beim Start und hat dafuer keinen Setter. Also VOR dem Bauen schreiben,
     sonst startet sie mit ihren Voreinstellungen und wechselt erst beim naechsten Laden.
     Was hier eingestellt wird: Gruppierung an, Listenansicht, NUR eigene Gruppierungen, Zeilenhoehe
     dynamisch, und die Spalte "Created" weg. Die Spalte ueber den Spaltenschluessel und nicht ueber
     CSS: so faellt ihre Spur im Raster mit weg -- eine per CSS versteckte Zelle laesst ihre Bahn
     stehen und schiebt die Zeile aus der Reihe. */
  function promptsVoreinstellen(){
    try {
      var ls = window.localStorage;
      if (!ls) return;
      ls.setItem("upt_grouped__" + ID.upt, "yes");
      ls.setItem("upt_groupmode__" + ID.upt, "custom");
      ls.setItem("upt_groupswide__" + ID.upt, "yes");
      ls.setItem("upt_rowheight__" + ID.upt, "dynamic");
      /* Created UND Topics weg, dafuer bleiben Sentiment und Market. Topics ist die Spalte, die im
         Schaustueck am wenigsten sagt -- die Gruppierung links nennt die Themen ohnehin -- und sie
         ist mit ihren 150px die einzige, deren Wegfall Platz fuer die zwei Kennzahlen macht. */
      ls.setItem("upt_cols__" + ID.upt, JSON.stringify({ created: false, topics: false }));
      /* Die Werkzeugleiste angepinnt: sie steht offen und faehrt nicht beim Ueberfahren heraus.
         "1" ist der Wert, den UC.makeTools dafuer liest (prefKey upt_tools__<id>). */
      ls.setItem("upt_tools__" + ID.upt, "1");
    } catch (e){}
  }

  /* Die Gruppierungen liegen seitenweit und ihr Schluessel traegt die Team-Id (UC.storeKey haengt
     sie an). Deshalb stehen sie NICHT bei den Voreinstellungen: die laufen vor bauen(), da kennt
     core noch kein Team, und geschrieben wuerde unter "promptGroups@_" -- gelesen spaeter unter
     "promptGroups@t1". Genau daran hingen die vier grauen Punkte statt der gedeckten Farben.
     color und nicht hex: groupChipHtml liest cg.color, ein anderer Name faellt still auf #6b7280
     zurueck. */
  function gruppierungenSchreiben(){
    if (!window.UpstreemCore || !window.UpstreemCore.cgWrite) return;
    window.UpstreemCore.cgWrite(GRUPPEN.map(function(g){
      return { key: g.key, tag_ids: g.tag_ids.slice(), color: g.hex };
    }));
  }

  function promptsFuellen(root){
    gruppierungenSchreiben();
    if (window.setPromptsTableTopics) window.setPromptsTableTopics(ID.upt, THEMEN);
    if (window.setPromptsTableBrands) window.setPromptsTableBrands(ID.upt,
      MARKEN.map(function(m){ return { company_id: m.id, name: m.name, logo_url: m.logo }; }));
    if (window.renderPromptsTable) window.renderPromptsTable({
      instanceId: ID.upt, rows: promptZeilen().slice(0, PROMPT_SEITE),
      totalCount: PROMPT_BESTAND, topics: THEMEN
    });
    /* Die Gruppen NACH den Zeilen: setGroups setzt die offene Gruppe zurueck, und in der
       Listenansicht steht dann "All Prompts" oben -- also genau die flache Liste, die eben
       gefuellt wurde. */
    if (window.setPromptsTableGroups) window.setPromptsTableGroups(ID.upt, gruppenZeilen());
    if (window.setPromptsTableLoading) window.setPromptsTableLoading(ID.upt, "no");
  }

  /* Sechs Sekunden nachdem Miras Antwort FERTIG GETIPPT ist, wechselt die Sektion auf die
     Prompts-Liste. Auf das Ende des Tippens gewartet und nicht auf eine feste Uhr: wie lange das
     Tippen dauert, entscheidet die Laenge der Antwort, und der Wechsel soll nach der Antwort
     kommen und nicht mitten hinein. */
  /* Nach Miras Antwort wird KUERZER gewartet als nach den anderen Seiten: der Mira-Schritt ist mit
     Tippen, Klicken, Laden und dem Tippen der Antwort der laengste der vier, und die Standzeit
     danach kam oben auf eine Seite, die schon eine Weile stillstand. Gemeldet als "die Animation
     bleibt irgendwann sehr lange bei Mira stehen". */
  /* 2200 -> 4200. Das ist die Standzeit NACH Miras fertiger Antwort, und genau die war zu kurz:
     die Antwort war eben erst fertig getippt, und zwei Sekunden spaeter war die Seite weg. */
  /* 4200 -> 6200: zwei Sekunden laenger auf der fertigen Antwort stehen bleiben (24.09.
     angefordert), und derselbe Wert wie STAND_MS bei der Prompts-Liste. */
  var PROMPTS_WARTEN = STAND_MS;

  function promptsAnsetzen(root){
    if (root.__ulhPromptsAn) return;
    root.__ulhPromptsAn = true;
    var n = 0, hatGetippt = false, ruhig = 0;
    var RUHE_TAKTE = 12;          /* 12 x 140ms ~ 1,7s Ruhe reichen als Beweis, dass nichts tippt */
    (function warten(){
      var am = root.querySelector("#ask-mira");
      /* Das Tippen muss ANGEFANGEN und geendet haben. Nur "keine Nachricht tippt gerade" reichte
         nicht und war der Fehler: zwischen dem Setzen der Liste und dem Beginn des Tippens liegen
         ein paar Frames (askMiraTypeLastAnswer fasst in 70ms-Schritten nach), und wer in dieses
         Fenster hineinmisst, sieht zwei Nachrichten und kein Tippen -- die Uhr lief also ab dem
         ABSCHICKEN und nicht ab der fertigen Antwort. Genau so kurz war der Schritt.
         am-is-typing steht an Miras Wurzel, am-typing an der Nachricht; beides zaehlt. */
      var tippt = !!(am && (am.classList.contains("am-is-typing") ||
                            am.querySelector(".am-msg.am-typing")));
      if (tippt) hatGetippt = true;
      var zwei = am && am.querySelectorAll(".am-msg").length >= 2;
      if (zwei && hatGetippt && !tippt){
        setTimeout(function(){ promptsSzene(root); }, PROMPTS_WARTEN);
        return;
      }
      /* WENN DAS TIPPEN NIE ANFAENGT, DARF DIE SZENE NICHT 30 SEKUNDEN STEHEN (21.09. gemeldet:
         "oft bleibt die Animation lange bei Mira stehen, wenn der Chat komplett da ist").
         Genau das war der Fall: die Bedingung darueber verlangt, dass das Tippen ANGEFANGEN und
         GEENDET hat. Faengt es gar nicht erst an -- eine Antwort, die ohne den Tippweg gerendert
         wird --, bleibt hatGetippt false, und es greift erst der Rueckhalt nach n > 214, also
         rund 30 Sekunden. Der Chat steht dabei fertig da und es passiert nichts.
         Also ein ZWEITER Ausgang: zwei Nachrichten, nichts tippt, und das seit RUHE_TAKTE
         Durchlaeufen am Stueck. 12 mal 140ms sind rund 1,7 Sekunden -- lang genug, dass ein
         Tippen, das gleich beginnt, den Zaehler wieder zurueckstellt (askMiraTypeLastAnswer
         fasst in 70ms-Schritten nach), und kurz genug, dass niemand davor wartet.
         Der alte Rueckhalt bleibt: er faengt den Fall, dass die zweite Nachricht spaet kommt. */
      if (zwei && !tippt && !hatGetippt){ if (++ruhig >= RUHE_TAKTE){
        setTimeout(function(){ promptsSzene(root); }, PROMPTS_WARTEN); return; } }
      else ruhig = 0;
      /* Rueckhalt: nach 30 Sekunden mit zwei Nachrichten reicht es. Und zwei Minuten Geduld
         insgesamt: in einem verdeckten Tab sind alle Uhren auf eine Sekunde gedrosselt, dort
         braucht die Mira-Szene ein Vielfaches ihrer Zeit. */
      if (zwei && n > 214){ setTimeout(function(){ promptsSzene(root); }, PROMPTS_WARTEN); return; }
      if (++n < 900) setTimeout(warten, 140);
    })();
  }

  /* Der Auftritt der Zeilen. Der Zaehler --ulh-i an jeder Zeile traegt die Staffelung; die CSS
     rechnet daraus die Verzoegerung.
     Erst SYNCHRON versuchen -- renderPromptsTable zeichnet die Zeilen sofort, wenn die Komponente
     schon steht --, und nur wenn dort noch nichts ist, im Takt nachfassen. Ohne den ersten Versuch
     waere zwischen dem Zeichnen und dem Setzen der Klasse ein Bild Zeit, und in diesem Bild
     stuenden die Zeilen schon fertig da, bevor sie hereinkommen.
     Die Uhr am Ende raeumt auf: bliebe is-zeilen stehen, liefe jede spaetere Bewegung in der
     Tabelle gegen eine noch gesetzte animation. */
  var ZEILEN_LAUF = 420, ZEILEN_STUFE = 55;
  /* Erst wenn der Kasten der Tabelle STEHT. Er selbst kommt mit 300ms Verzoegerung und laeuft 520,
     ist also bei 820 da. Fangen die Zeilen vorher an, laufen sie innerhalb einer Flaeche, die als
     Ganzes aufblendet -- und dann sieht man nur den Kasten kommen, nicht die Zeilen. Genau das war
     der Bericht. */
  var ZEILEN_START = 760;

  function zeilenAnsetzen(root, seite){
    var n = 0;
    function versuch(){
      var zeilen = root.querySelectorAll(".ulh-prompts .up-tbody .up-row");
      /* Auf die ECHTEN Zeilen gewartet und nicht auf die ersten, die da sind: die Tabelle zeichnet
         beim Start ein Skelett aus sechs Zeilen, und darauf gestaffelt haette der Auftritt die
         falschen Zeilen bewegt. Gemessen: 650ms nach dem Laden standen genau diese sechs im
         Koerper. Nach der Geduldsfrist wird genommen, was da ist -- unsichtbare Zeilen sind
         schlimmer als eine Staffelung auf der falschen Zahl. */
      if (zeilen.length !== PROMPT_SEITE && n < 120){
        n++; setTimeout(versuch, 16); return;
      }
      if (!zeilen.length) return;
      for (var i = 0; i < zeilen.length; i++) zeilen[i].style.setProperty("--ulh-i", i);
      seite.classList.add("is-zeilen");
      setTimeout(function(){
        seite.classList.remove("is-zeilen");
        for (var j = 0; j < zeilen.length; j++) zeilen[j].style.removeProperty("--ulh-i");
      }, ZEILEN_LAUF + zeilen.length * ZEILEN_STUFE + 200);
    }
    /* Die Zeilen stehen schon im DOM, wenn dieser Aufruf kommt -- gewartet wird nicht auf sie,
       sondern auf den Kasten. Der Koerper der Tabelle ist bis dahin versteckt (is-kommt in der
       CSS), es blitzt also nichts auf. */
    setTimeout(versuch, ZEILEN_START);
  }

  function promptsSzene(root){
    var mira = root.querySelector(".ulh-mira");
    var seite = root.querySelector(".ulh-prompts");
    if (!mira || !seite || seite.__ulhPromptsAuf) return false;
    seite.__ulhPromptsAuf = true;
    /* is-da MIT abnehmen und nicht nur is-weg dazu: eine Seite, die weg ist, ist nicht mehr die
       aktuelle. Die Reihenfolge in der CSS faengt den Fall auch ab, aber zwei Klassen, die sich
       widersprechen, sind kein Zustand, den man stehen lassen sollte. */
    mira.classList.remove("is-da");
    mira.classList.add("is-weg");
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "prompts");
    setTimeout(function(){
      seite.classList.remove("is-weg");
      seite.classList.add("is-da");
      seite.classList.add("is-kommt");
      /* Laenger stehen lassen als bei Mira: hier haengen vier gestaffelte Auftritte daran, der
         letzte startet bei 300ms und laeuft 520 -- also 820 plus Reserve. */
      /* is-kommt haelt den Tabellenkoerper versteckt, bis is-zeilen uebernimmt (ZEILEN_START).
         Es muss also LAENGER stehen als dieser Start, sonst waeren die Zeilen zwischendurch
         sichtbar und wuerden gleich danach wieder verschwinden. */
      setTimeout(function(){ seite.classList.remove("is-kommt"); }, 1000);
      chancenAnsetzen(root);
      hellHalten(root);
      promptsFuellen(root);
      zeilenAnsetzen(root, seite);
      /* Nach dem Fuellen noch einmal: die Tabelle setzt ihre Tooltips beim Zeichnen, und die sollen
         im Schaustueck nicht erscheinen. Zweimal, weil sie ihre Zeilen in zwei Schueben baut. */
      ohneTipps(root);
      setTimeout(function(){ ohneTipps(root); hellHalten(root); }, 400);
      setTimeout(function(){ ohneTipps(root); }, 1200);
    }, AUSBLENDEN_MS);
    return true;
  }

  /* ---------- Vierte Szene: das Opportunities-Brett ---------------------------------------- */

  /* Die Karten. Aufbau je Zeile: Kennung, Spalte, Empfehlungstyp, Ueberschrift, Begruendung,
     Prioritaet, Quelle (Titel, Domain, Zitattyp), Markt, Zahl der genannten Wettbewerber, Punktzahl.
     Die Marken darin sind DIESELBEN sechs wie im Dashboard, bei Mira und in der Prompts-Liste --
     eine vierte Markenliste in derselben Sektion waere der auffaelligste Bruch, den sie haben
     koennte.

     VIER Karten: drei in Pending, eine in In Progress, keine in Done. Das ist der Anfangszustand,
     aus dem die Szene ihre zwei Zuege macht -- o2 wandert nach In Progress, danach o4 (die von
     Anfang an dort stand) nach Done. Am Ende steht in jeder Spalte etwas, und man hat gesehen,
     wie es dort hingekommen ist. Ein volles Brett mit sieben Karten konnte das nicht zeigen: mit
     zwei Karten schon in Done sah der zweite Zug wie ein Nachschub aus.

     Die Domains sind ECHT, wo die Quelle fremd ist (forbes.com, reddit.com, youtube.com), und
     erfunden, wo sie der eigenen Marke gehoert (acme.com) -- dieselbe Aufteilung wie im
     Zitatteil des Dashboards, Begruendung dort. Die Ueberschriften sind dabei als AUFGABE oder
     als Aussage ueber die eigene Marke formuliert und nicht als Aussage ueber die fremde Seite:
     "hol dir den Platz im Test" statt "das Magazin verschweigt dich". Das ist bei ECHTEN
     Wettbewerbernamen wichtiger als vorher: eine Karte darf sagen, wo Acme fehlt, aber nichts
     darueber behaupten, wie eine fremde Redaktion arbeitet. */
  var CHANCEN = [
    ["o1", "pending", "get_listed", "Get the estate into the forbes.com buyer guide",
     "BMW and Audi are in it. You are not.",
     "High", "The Best Luxury Electric SUVs You Can Buy In 2026", "forbes.com", "Editorial", "US", 4, 88.4],
    ["o2", "pending", "create_matching_content", "No page of yours answers \u201ewhat is the real winter range\u201c",
     "214 runs a month, and never one of your pages.",
     "Medium", "Winter range thread", "reddit.com", "UGC_Community", "US", 3, 61.2],
    ["o3", "pending", "improve_existing_content", "Your charging page is cited but never quoted",
     "Models reach the page and quote a competitor.",
     "Low", "Charging and range overview", "acme.com", "Brand_Platform", "DE", 2, 34.5],
    ["o4", "in_progress", "build_presence", "Show up in the two comparison videos that decide this class",
     "Both rank top three, and both of them name Audi.",
     "High", "Which electric SUV would you buy in 2026?", "youtube.com", "UGC_Community", "US", 5, 79.1]
  ];

  var CHANCEN_TYP = { get_listed: "Get listed", create_matching_content: "Create matching content",
                      improve_existing_content: "Improve existing content", build_presence: "Build presence" };

  function chancenListe(){
    return CHANCEN.map(function(c, i){
      var m = MARKEN.slice(1, 1 + c[10]);   /* die genannten Wettbewerber: nie die eigene Marke */
      return {
        id: c[0],
        status: { pending: "Created", in_progress: "In Progress", done: "Done", ignored: "Ignored" }[c[1]],
        recommendation_type: c[2],
        label: CHANCEN_TYP[c[2]] || "Opportunity",
        headline: c[3],
        reason: c[4],
        priority_label: c[5],
        lead_title: c[6],
        lead_domain: c[7],
        /* Das Zeichen der Quelle: echt bei einer fremden Domain, das Markenkaestchen bei der
           eigenen -- fuer acme.com gibt es kein echtes, die Marke ist erfunden. */
        lead_favicon: c[7].indexOf("acme.com") >= 0 ? MARKEN[0].logo : quellzeichen(c[7]),
        lead_url: "https://" + c[7],
        effective_citation_type: c[8],
        market: c[9],
        source_scope: "external_only",
        competitor_count: c[10],
        /* Die Punktzahl steht im Ausklapper neben der Bezeichnung ("High \u00b7 88.4"). Ohne sie
           stand dort "High \u00b7 0" -- die Komponente rechnet mit 0, wenn das Feld fehlt. Sie
           passt zu der Bezeichnung: potLevel nimmt zuerst das Wort und nur ohne Wort die Zahl
           (hoch ab 75, mittel ab 50, niedrig ab 25), und zwei Angaben, die sich widersprechen,
           waeren schlimmer als eine fehlende. Nach ihr sortiert das Brett auch innerhalb der
           Spalte -- die Reihenfolge o1, o2, o3 ist also die der Zahlen. */
        priority_score: c[11],
        /* Die Zahlen sind aus dem Platz in der Liste gerechnet und nicht gewuerfelt: dasselbe Bild
           bei jedem Laden, und sie fallen von oben nach unten, wie man es erwartet. */
        global_share_pct: Math.round((18.4 - i * 1.7) * 10) / 10,
        trend_pct: Math.round((3.2 - i * 1.1) * 10) / 10,
        gap: Math.round((-22.6 + i * 2.4) * 10) / 10,
        your_conversion: Math.round((9.4 - i * 0.6) * 10) / 10,
        avg_competitor_conversion: Math.round((26.1 - i * 1.2) * 10) / 10,
        supporting_urls_count: 2 + (i % 3),
        created_at: new Date().toISOString(),
        /* Zwei Themen auf der ersten und der letzten Karte, eines auf den beiden dazwischen.
           Vier Karten mit genau einem Thema lesen sich, als koennte eine Karte nur eines
           tragen -- sie kann mehrere, und das soll man sehen. */
        topics: (i === 0 || i === 3)
          ? [THEMEN[i % THEMEN.length], THEMEN[(i + 2) % THEMEN.length]]
          : [THEMEN[i % THEMEN.length]],
        mentioned_competitors: m.map(function(b){
          return { name: b.name, company_id: b.id, favicon_url: b.logo };
        })
      };
    });
  }

  function chancenFuellen(){
    if (window.opportunitiesSetVisibleBoards) window.opportunitiesSetVisibleBoards(
      { pending: true, in_progress: true, done: true, ignored: false });
    if (window.opportunitiesSetMode) window.opportunitiesSetMode("board");
    if (window.opportunitiesSetItems) window.opportunitiesSetItems(chancenListe());
    if (window.opportunitiesSetLoading) window.opportunitiesSetLoading("no");
  }

  /* ---- Der Zug einer Karte ----
     opportunitiesSetStatus zeichnet das Brett neu -- die Karte steht danach in der neuen Spalte,
     und zwar SOFORT. Damit sie WANDERT, wird davor jede Lage gemessen und danach jede Karte von
     ihrer alten Stelle zurueckgefahren: FLIP, dieselbe Machart wie bei den Markenzeilen im
     Dashboard, nur in zwei Richtungen -- eine Karte wechselt die Spalte, also aendert sich auch x.
     offsetLeft/offsetTop und NICHT getBoundingClientRect: die Buehne steht unter transform: scale,
     und das Rechteck liefert die verkleinerten Masse. Gemessen im Dashboard: 94 Layoutpixel kamen
     als 70 heraus. */
  /* Der Zug selbst, langsamer als zuerst: 620 -> 800ms. Eine Karte ist ein grosses Ding und
     wandert bis zu zwei Spalten weit -- auf 620ms sah das nach Umschalten aus, nicht nach
     Verschieben. */
  /* 800 -> 1300 (21.09. gemeldet: "zu hektisch"). Ein Zug ist die einzige Bewegung, die das
     Brett zeigt, und sie soll sich lesen lassen, nicht huschen. */
  /* 1300 -> 910, also 30 Prozent schneller (24.09. angefordert). */
  var CHANCEN_ZUG = 910;
  /* Angefasst wird nur noch EINE Karte: die, die sich danach als Schublade oeffnet. Bei den zwei
     Zuegen fiel es weg -- eine Karte, die vor dem Wandern gedrueckt wird, erklaert die Bewegung
     nicht besser, und drei Druckstellen in zehn Sekunden sind eine zu viel.
     Es gibt keinen Zeiger im Bild, also stehen dafuer zwei Klassen (landing-hero.css): erst der
     Hover, dann der Druck -- drei Prozent kleiner und zurueck. */
  var FASS_MS = 420, DRUCK_AB = 190, DRUCK_NACH = 170;
  var FASSEN_GESAMT = FASS_MS + DRUCK_AB + DRUCK_NACH;

  function kartenLagen(root){
    var lagen = {};
    [].slice.call(root.querySelectorAll(".uo-card")).forEach(function(k){
      lagen[k.getAttribute("data-id")] = { x: k.offsetLeft, y: k.offsetTop };
    });
    return lagen;
  }

  function kartenWandern(root, lagen){
    var reihe = [];
    [].slice.call(root.querySelectorAll(".uo-card")).forEach(function(k){
      var alt = lagen[k.getAttribute("data-id")];
      if (!alt) return;                       /* neu im Bild: kommt ohne Wanderung */
      var dx = alt.x - k.offsetLeft, dy = alt.y - k.offsetTop;
      if (!dx && !dy) return;
      reihe.push({ el: k, dx: dx, dy: dy });
    });
    if (!reihe.length) return;
    reihe.forEach(function(r){
      r.el.style.position = "relative";
      /* Die Karte, die die Spalte wechselt, liegt vorn: sie ist die einzige, die ueber andere
         hinwegzieht. Erkennbar am Weg -- nur sie aendert x. */
      r.el.style.zIndex = r.dx ? "3" : "2";
      r.el.style.transition = "transform 0s";
      /* NUR die wandernde Karte wird ausgegraut, und AUSGEGRAUT heisst grau -- nicht
         durchsichtig (21.09. angefordert: "ausgrauen ja, aber nicht opacity kleiner 1"). Die
         Klasse traegt die Farben, die Deckkraft bleibt bei 1; die Werte stehen in
         landing-hero.css. Nur bei einem Spaltenwechsel: eine Karte, die nur nachrutscht, wird
         nicht angefasst, sie wird ja nicht gezogen. */
      if (r.dx) r.el.classList.add("ulh-zieht");
      r.el.style.transform = "translate(" + r.dx + "px," + r.dy + "px)";
    });
    void reihe[0].el.offsetHeight;
    requestAnimationFrame(function(){
      reihe.forEach(function(r){
        /* DER WEG IST JETZT EINE BEWEGUNG UND KEIN SCHIEBEN (21.09.: "das Hin und Her gefaellt
           mir gar nicht, mach das schoener"). Die wandernde Karte hebt sich beim Losfahren
           leicht an und legt sich am Ziel wieder ab -- dieselbe Geste, die eine Hand macht.
           Die zwei Schritte stecken in einer eigenen Kurve: box-shadow und scale laufen mit dem
           transform, deshalb stehen sie in derselben transition. */
        r.el.style.transition = "transform " + CHANCEN_ZUG + "ms " + WEICH +
                                ", box-shadow " + CHANCEN_ZUG + "ms " + WEICH +
                                ", background-color 200ms ease, border-color 200ms ease";
        r.el.style.transform = "translate(0,0)";
      });
    });
    setTimeout(function(){
      reihe.forEach(function(r){
        r.el.style.transition = ""; r.el.style.transform = "";
        r.el.style.position = ""; r.el.style.zIndex = "";
        r.el.classList.remove("ulh-zieht");
      });
    }, CHANCEN_ZUG + 120);
  }

  function karte(root, id){ return root.querySelector('.uo-card[data-id="' + id + '"]'); }

  /* Die Schublade HART zumachen -- und nicht nur closeDetail rufen (21.09. gemeldet: "Es kommt
     vor, dass sofort das DetailSidebar bei Opportunities oeffnet, wenn der Step kommt").
     Der Weg dorthin: opportunities.js nimmt beim Schliessen zuerst detail-in ab und erst 200ms
     spaeter detail-open -- ein Timer. Solange er laeuft, traegt der Portalkasten detail-open
     weiter. Faellt in dieses Fenster ein Neustart der Szene (der Besucher scrollt weg und wieder
     hin, oder der Tab lag im Hintergrund und die Uhren holen zusammengedraengt auf), blendet die
     Chancen-Seite mit einer Schublade auf, die noch offen aussieht.
     Deshalb hier synchron: den Zustand in der Komponente ueber closeDetail loeschen (nur so ist
     auch S.detailId weg, sonst zeichnet das naechste setOpportunities die Schublade wieder auf),
     und die zwei Klassen am Portalkasten selbst abnehmen, ohne auf dessen Timer zu warten.
     Der Kasten liegt IM Fenster, nicht am <body> -- data-portal="inline", siehe .landing_markup.py. */
  function schubladeZu(root){
    if (window.opportunitiesCloseDetail){
      try { window.opportunitiesCloseDetail(); } catch (e){}
    }
    var kasten = root.querySelector(".uo-portal");
    if (kasten){
      kasten.classList.remove("detail-in");
      kasten.classList.remove("detail-open");
    }
  }

  /* Anfassen, druecken, loslassen -- und DANN ziehen. fertig() laeuft, wenn die Karte ihre Groesse
     wiederhat: der Zug darf erst danach anfangen, siehe FASS_MS. */
  function karteKlicken(root, id, fertig){
    var k = karte(root, id);
    if (!k){ fertig(); return; }
    k.classList.add("ulh-fass");
    setTimeout(function(){
      k.classList.add("ulh-druck");
      setTimeout(function(){
        k.classList.remove("ulh-druck");
        setTimeout(fertig, DRUCK_NACH);
      }, DRUCK_AB);
    }, FASS_MS);
  }

  function karteZiehen(root, id, ziel){
    if (!window.opportunitiesSetStatus) return false;
    var lagen = kartenLagen(root);
    window.opportunitiesSetStatus(id, ziel);
    kartenWandern(root, lagen);
    ohneTipps(root);
    return true;
  }
  /* So lange dauert ein Zug insgesamt -- der Ablauf unten rechnet damit. */
  var ZUG_GESAMT = CHANCEN_ZUG + 140;

  /* ---- Der Auftritt der Karten ----
     Die Spalten kommen gestaffelt (landing-hero.css: 300/400/500ms, je 520 lang), also stehen sie
     bei 1020. Erst DANACH fallen die Karten einzeln ein -- eine Karte, die innerhalb einer noch
     aufblendenden Spalte auftritt, tritt nicht auf. Dieselbe Lehre wie bei den Zeilen der
     Prompts-Tabelle, und derselbe Weg: der Zaehler --ulh-i steht an der Karte, die CSS rechnet
     daraus die Verzoegerung. Gezaehlt wird quer ueber alle Spalten in Lesereihenfolge (das ist die
     DOM-Reihenfolge: Spalte fuer Spalte, darin von oben nach unten). */
  var KARTEN_START = 1060, KARTEN_STUFE = 90, KARTEN_LAUF = 420;

  function kartenAnsetzen(root, seite){
    setTimeout(function(){
      var k = root.querySelectorAll(".uo-card");
      if (!k.length) return;
      for (var i = 0; i < k.length; i++) k[i].style.setProperty("--ulh-i", i);
      seite.classList.add("is-karten");
      /* Aufraeumen, sobald die letzte Karte steht: bliebe is-karten haengen, liefe der erste Zug
         gegen eine noch gesetzte animation -- und eine laufende animation schlaegt jeden
         Inline-Stil, also auch den des FLIP. */
      setTimeout(function(){
        seite.classList.remove("is-karten");
        for (var j = 0; j < k.length; j++) k[j].style.removeProperty("--ulh-i");
      }, KARTEN_LAUF + k.length * KARTEN_STUFE + 160);
    }, KARTEN_START);
  }

  /* ---- Der Ablauf der Szene ----
     Erst stehen die Karten still, dann wird eine von Pending nach In Progress gezogen, dann die,
     die von Anfang an in In Progress stand, nach Done -- am Ende steht in jeder Spalte etwas.
     Danach vier Sekunden Ruhe, die Karte oben links geht als Schublade auf, bleibt vier Sekunden
     offen, schliesst sich, und die Sektion faengt wieder beim Dashboard an.
     Die Zahlen sind Abstaende zwischen fertigen Bewegungen und keine Startzeitpunkte: ZUG_GESAMT
     (1720ms) steckt in jedem Zug, und was hier steht, ist die RUHE danach. */
  var CHANCEN_ERST = 2150;      /* nach dem Fuellen -- die Karten stehen bei ~1750 */
  var CHANCEN_ZWEIT = 1500;     /* Ruhe zwischen den zwei Zuegen -- 700 war zu knapp (21.09.) */
  /* 5200 -> 3200 (24.09. angefordert: "der bleibt zu lange stehen, gut zwei Sekunden kuerzer").
     Das ist der Stand NACH dem zweiten Zug -- die Karte liegt in Done, und danach geht die
     Schublade auf. */
  /* 5200 -> 3200 -> 2400: noch einmal kuerzer (24.09.). Das ist der Stand NACH dem zweiten Zug --
     die Karte liegt in Done, und danach geht die Schublade auf. */
  /* Seit dem 06.10. spaet aus dem Takt der Runde (STAND_MS/VOR_KLICK_MS, Begruendung dort):
     vorher 2400 und 4000. */
  var CHANCEN_HALT = VOR_KLICK_MS;   /* das Brett steht, bevor die Karte aufgeht */
  var CHANCEN_OFFEN = STAND_MS;      /* wie lange die Schublade offen bleibt -- der Endzustand */
  var CHANCEN_ZU = 520;         /* das Zufahren der Schublade, bevor die Seite geht */

  function chancenAblauf(root){
    var t = CHANCEN_ERST;
    setTimeout(function(){ karteZiehen(root, "o2", "in_progress"); }, t);
    t += ZUG_GESAMT + CHANCEN_ZWEIT;
    setTimeout(function(){ karteZiehen(root, "o4", "done"); }, t);
    t += ZUG_GESAMT + CHANCEN_HALT;
    setTimeout(function(){
      /* Erst der Klick auf die Karte, dann geht sie auf -- so hat das Aufgehen einen Ausloeser
         im Bild und passiert nicht aus dem Nichts. */
      karteKlicken(root, "o1", function(){
        if (window.opportunitiesOpenDetail) window.opportunitiesOpenDetail("o1");
        /* Die Hand geht von der Karte, sobald die Schublade offen ist: eine Karte, die weiter
           angefasst aussieht, waehrend ihr Inhalt daneben offen steht, ist ein Zustand zu viel.
           Nach dem Oeffnen gesucht, weil das Brett dabei neu zeichnet -- die Karte im DOM ist
           danach eine andere. */
        var k = karte(root, "o1");
        if (k) k.classList.remove("ulh-fass");
        /* Die Schublade bringt ihre eigenen Tooltips mit, und die sollen im Schaustueck nicht
           erscheinen. Zweimal, weil sie ihren Inhalt in zwei Schueben baut. */
        ohneTipps(root);
        setTimeout(function(){ ohneTipps(root); hellHalten(root); }, 400);
      });
    }, t);
    t += FASSEN_GESAMT + CHANCEN_OFFEN;
    setTimeout(function(){
      if (window.opportunitiesCloseDetail) window.opportunitiesCloseDetail();
    }, t);
    t += CHANCEN_ZU;
    /* Nicht zurueck auf Anfang, sondern eine Szene weiter: Performance. Erst danach faengt der
       Kreislauf von vorn an. */
    setTimeout(function(){ perfSzene(root); }, t);
  }

  /* Der Wechsel von der Prompts-Liste auf das Brett -- derselbe Bau wie die Wechsel davor. */
  function chancenAnsetzen(root){
    if (root.__ulhChancenAn) return;
    root.__ulhChancenAn = true;
    /* Die Prompts-Liste steht STAND_MS still, nachdem ihre Zeilen eingelaufen sind. Deren Auftritt
       endet bei ZEILEN_START plus Lauf plus Staffelung -- danach beginnt die Ruhe. */
    var zeilenEnde = ZEILEN_START + ZEILEN_LAUF + PROMPT_SEITE * ZEILEN_STUFE;
    /* Seit dem 06.10. kommt zwischen Prompts und Chancen Shopping ("Shopping vor Opportunities");
       Shopping ruft am Ende selbst chancenSzene. */
    setTimeout(function(){ shopSzene(root); }, AUSBLENDEN_MS + zeilenEnde + STAND_MS);
  }

  /* ---------- Fuenfte Szene: Performance -----------------------------------------------------
     Die Heatmap Thema x Marke, dieselbe Komponente wie in der App (performance-radar.js).
     Die Zahlen entstehen aus den Marken- und Themendaten, die die Sektion ohnehin zeigt: die
     Sichtbarkeit einer Marke ist ihr Wert aus dem Dashboard, je Thema um einen festen Faktor
     verschoben. So passen die Zahlen hier zu den Zahlen zwei Szenen vorher -- eine Marke, die im
     Chart vorn liegt, liegt es auch in der Matrix. */
  var PERF_THEMEN = 8, PERF_MARKEN = 5;
  /* Ein Faktor je Thema und Marke. Er macht aus fuenf gleichen Zeilen ein Bild mit Staerken und
     Luecken -- und genau das ist der Zweck der Matrix. Acme (erste Spalte) ist bei Pricing und
     Electric stark und bei Fleet schwach; das ist die Geschichte, die die Sektion auch sonst
     erzaehlt. */
  var PERF_FAKTOR = [
    [1.35, 0.95, 1.30, 0.80, 0.55],
    [0.90, 1.20, 0.85, 1.15, 1.25],
    [1.05, 0.80, 1.10, 0.90, 1.00],
    [0.70, 1.05, 0.75, 1.30, 0.95],
    [0.85, 0.90, 1.20, 0.70, 1.15],
    [1.15, 0.75, 0.95, 1.05, 0.80],
    [0.95, 1.30, 1.05, 0.85, 0.70],
    [0.60, 1.10, 0.90, 1.20, 1.05]
  ];

  /* Der Versatz je Feld. Er macht aus einer gleichmaessigen Flaeche ein Bild mit ein paar sehr
     guten und ein paar schlechten Stellen -- vier nach oben, vier nach unten, der Rest ruhig. */
  var PERF_STIMMUNG = [
    [  6,  -4,   2, -18,  -9],
    [ -7,  14,  -2,   4,  11],
    [  3,  -9,   8, -14,   0],
    [-16,   5, -11,  17,   2],
    [  9,  -2,  13,  -7,  -5],
    [ -3,  11,  -6,   2,  15],
    [ 12,  -8,   4, -12,  -2],
    [-13,   7,  -4,  10,   6]
  ];

  function perfZellen(){
    var themen = THEMEN.slice(0, PERF_THEMEN);
    var marken = MARKEN.slice(0, PERF_MARKEN);
    var zellen = [];
    var maxVis = 0, minVis = 100, maxSent = 0, minSent = 100, maxRang = 0, minRang = 10;
    themen.forEach(function(t, ti){
      marken.forEach(function(m, mi){
        var f = PERF_FAKTOR[ti][mi];
        var vis = Math.round(m.b.vis * f * 10) / 10;
        /* Die Stimmung streut staerker als die Sichtbarkeit und hat AUSREISSER -- eine Matrix, in
           der alle Werte um 75 liegen, zeigt keine Staerken und keine Luecken, und genau die soll
           sie zeigen. Der Grundwert kommt aus dem Faktor, dazu ein fester Versatz je Feld. */
        var sent = Math.max(31, Math.min(97,
          Math.round(m.b.sent + (f - 1) * 42 + (PERF_STIMMUNG[ti] ? (PERF_STIMMUNG[ti][mi] || 0) : 0))));
        var rang = Math.max(1, Math.round((m.b.rank / f) * 10) / 10);
        var erw = Math.round(140 * f + ti * 9 + mi * 5);
        maxVis = Math.max(maxVis, vis); minVis = Math.min(minVis, vis);
        maxSent = Math.max(maxSent, sent); minSent = Math.min(minSent, sent);
        maxRang = Math.max(maxRang, rang); minRang = Math.min(minRang, rang);
        zellen.push({
          topic_id: t.id, topic_name: t.name, topic_emoji: t.emoji,
          topic_hex_light: t.hex_light, topic_hex_dark: t.hex_dark, topic_position: ti + 1,
          company_id: m.id, company_name: m.name, logo_url: m.logo,
          company_position: mi + 1, role: mi === 0 ? "own" : "competitor",
          visibility_pct: vis, sentiment: sent, avg_rank: rang, mentions: erw,
          visibility_prev_pct: Math.round((vis - m.b.visD) * 10) / 10,
          sentiment_prev: sent - Math.round(m.b.sentD),
          avg_rank_prev: Math.round((rang - m.b.rankD) * 10) / 10,
          mentions_prev: erw - 12,
          visibility_delta_pct: m.b.visD, sentiment_delta: Math.round(m.b.sentD),
          avg_rank_delta: m.b.rankD
        });
      });
    });
    /* Die Waerme ist der Rang INNERHALB der gezeigten Zahlen, nicht der Wert selbst: sonst sieht
       eine Matrix, in der alle zwischen 20 und 40 Prozent liegen, gleichmaessig lau aus. Beim
       Rang ist WENIGER besser, die Skala laeuft dort also andersherum. */
    function anteil(v, min, max){ return max > min ? (v - min) / (max - min) : 0.5; }
    zellen.forEach(function(z){
      z.heat_value_visibility = Math.round(anteil(z.visibility_pct, minVis, maxVis) * 100) / 100;
      z.heat_value_sentiment  = Math.round(anteil(z.sentiment, minSent, maxSent) * 100) / 100;
      z.heat_value_rank       = Math.round((1 - anteil(z.avg_rank, minRang, maxRang)) * 100) / 100;
    });
    return { zellen: zellen, themen: themen, marken: marken,
             bereiche: { visibility_min: minVis, visibility_max: maxVis,
                         sentiment_min: minSent, sentiment_max: maxSent,
                         rank_min: minRang, rank_max: maxRang } };
  }

  function perfFuellen(){
    if (!window.renderPerformanceRadar) return false;
    var d = perfZellen();
    window.renderPerformanceRadar({
      instanceId: ID.uhm,
      metric: "visibility",
      cells: d.zellen,
      ranges: d.bereiche,
      selection: { topic_limit: 12, company_limit: 12 },
      selected_topics: d.themen.map(function(t, i){
        return { topic_id: t.id, name: t.name, emoji: t.emoji,
                 hex_light: t.hex_light, hex_dark: t.hex_dark, selected_position: i + 1 };
      }),
      selected_companies: d.marken.map(function(m, i){
        return { company_id: m.id, name: m.name, logo_url: m.logo,
                 role: i === 0 ? "own" : "competitor", selected_position: i + 1 };
      }),
      available_topics: THEMEN.map(function(t, i){
        return { topic_id: t.id, name: t.name, emoji: t.emoji,
                 hex_light: t.hex_light, hex_dark: t.hex_dark, position: i + 1 };
      }),
      available_companies: MARKEN.map(function(m, i){
        return { company_id: m.id, name: m.name, logo_url: m.logo,
                 role: i === 0 ? "own" : "competitor", position: i + 1 };
      })
    });
    return true;
  }

  /* KEINE Karte mehr in dieser Szene. Sie stand fest an einer Zelle und wurde von einer Uhr
     gehalten, weil die Komponente sie bei jedem Neuzeichnen wegraeumt -- eine zweite Quelle von
     Bewegung in einem Bild, das schon zwei Ansichten zeigt, und eine Uhr mehr, die einen Neustart
     ueberleben konnte. Die Zellen sind hier ausserdem nicht anfassbar (landing-hero.css:
     .ulh-perf .uhm-scroll { pointer-events: none }), also ruft auch eine echte Maus keine hervor.
     Der Aufraeumer bleibt: eine Karte aus einer frueheren Runde soll nicht stehen bleiben. */
  function perfTippWeg(){
    if (window.destroyHeatmapTooltip) window.destroyHeatmapTooltip(ID.uhm);
  }

  /* Die Uhren dieser Szene an EINER Stelle. Vorher lief jede fuer sich, und beim Neustart der
     Schleife liefen die alten weiter: eine davon schaltete mitten in der frischen
     Sichtbarkeits-Ansicht auf Stimmung um. Das war das "manchmal sieht man die Sichtbarkeit gar
     nicht, oder sie blitzt kurz auf". */
  var perfUhren = [];
  function perfNach(fn, ms){ perfUhren.push(setTimeout(fn, ms)); }
  function perfUhrenAus(){
    perfUhren.forEach(function(u){ clearTimeout(u); });
    perfUhren = [];
  }

  var PERF_AUF_MS    = 1000;  /* der Auftritt der Zellen: 560ms Dauer plus 360ms diagonaler
                                 Versatz (--uhm-pop: 2 in der landing-hero.css), aufgerundet */
  var PERF_STAND_MS  = STAND_MS;  /* so lange steht jede der zwei Ansichten -- NACH ihrem Auftritt
                                     (bis zum 06.10. 6000, jetzt der Takt der Runde) */
  var PERF_ABGANG_MS = 450;   /* der Weg hinaus: 390ms Bewegung plus Zugabe fuer den Tausch */
  var PERF_SEITE_MS  = 380;   /* erst steht die Seite, dann kommen die Daten -- siehe unten */

  /* Warten, bis die Matrix ihre Zellen gezeichnet hat, und ERST DANN auftreten lassen. Vorher
     faehrt eine leere Flaeche herauf, und das sieht aus wie gar keine Bewegung. */
  function perfWennGezeichnet(root, dann){
    var n = 0;
    (function schauen(){
      if (root.querySelector(".ulh-perf .uhm-cell:not(.is-sk)")){ dann(); return; }
      if (++n < 60) setTimeout(schauen, 80);
      else dann();                       /* nach 5s trotzdem: lieber ohne Zellen als gar nicht */
    })();
  }

  /* Eine Ansicht aufbauen: Metrik setzen, Balken setzen, LEEREN, fuellen. Keiner der Schritte
     davor ist Zierde.
     Die METRIK muss von aussen gesetzt werden: der Wert im Payload gilt nur beim allerersten
     Render ("an explicit metric in the payload only wins the FIRST time", performance-radar.js),
     danach gehoert sie dem Umschalter -- und der stand seit der letzten Runde auf Stimmung. Die
     zweite Runde begann deshalb bei der Stimmung, und die Sichtbarkeit war nie zu sehen. Genau
     das war gemeldet.
     GELEERT wird, damit der Auftritt ueberhaupt laeuft: die Komponente baut ihr Raster nur neu,
     wenn keines mit Daten dasteht (render() geht sonst ueber paintCells), und runAppear haengt am
     Neubau. Ohne das Leeren wechselten in der zweiten Runde nur die Farben -- das war das
     "die Appear-Animation ist nicht zuverlaessig".
     Beides ueber die API der Komponente und nicht ueber einen Klick auf den Umschalter: die
     Buehne schluckt Klicks in der Einfangphase (nurSchauen), damit im Schaustueck nichts
     bedienbar ist -- der Klick kam nie an. Gemessen. */
  function perfAnsicht(root, metrik, balken){
    if (window.setPerformanceRadarMetric) window.setPerformanceRadarMetric(ID.uhm, metrik);
    if (window.setPerformanceRadarWeights) window.setPerformanceRadarWeights(ID.uhm, balken ? "yes" : "no");
    if (window.resetPerformanceRadar) window.resetPerformanceRadar(ID.uhm);
    perfFuellen();
    perfTippWeg();
  }

  /* Die Matrix geht: erst hinaus, dann wird getauscht. Ein Umschalten unter der stehenden Matrix
     waere ein Wechsel der Zahlen, kein Wechsel der Ansicht; gefragt war das zweite. */
  function perfHinaus(root){
    var karte = root.querySelector(".ulh-perf .uhm-root");
    if (karte) karte.classList.add("is-geht");
    return karte;
  }

  /* Der Schluss der Szene: die Matrix geht hinaus wie zwischen den zwei Ansichten, und ERST DANN
     wechselt die Seite. Vorher endete die Stimmung mit dem Seitenwechsel, und der Abgang, den die
     erste Ansicht hatte, fehlte der zweiten. */
  function perfSchluss(root){
    perfHinaus(root);
    perfNach(function(){ neustart(root); }, PERF_ABGANG_MS);
  }

  function perfSzene(root){
    var seite = root.querySelector(".ulh-perf");
    if (!seite || seite.__ulhPerfAuf) return false;
    seite.__ulhPerfAuf = true;
    /* Weg geht die Seite, die GERADE dran ist -- im Kreislauf ist das das Chancen-Brett, beim
       Messen kann es jede andere sein. Nur das Brett anzusprechen hiess: die Szene laeuft, aber
       hinter ihr bleibt die alte Seite stehen. */
    [].forEach.call(root.querySelectorAll(".ulh-seite.is-da"), function(alt){
      if (alt === seite) return;
      alt.classList.remove("is-da");
      alt.classList.add("is-weg");
    });
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "performance");
    /* Uhren einer frueheren Runde anhalten, BEVOR neue gestellt werden. Ohne das lief die alte
       Uhr fuer den Wechsel auf die Stimmung in die neue Runde hinein. */
    perfUhrenAus();
    perfTippWeg();
    /* Und die Matrix wieder sichtbar machen: sie geht am Ende der Szene hinaus (is-geht) und
       traegt die Klasse sonst in die naechste Runde. */
    var karte = root.querySelector(".ulh-perf .uhm-root");
    if (karte) karte.classList.remove("is-geht");
    perfNach(function(){
      seite.classList.remove("is-weg");
      seite.classList.add("is-da");
      hellHalten(root);
      ohneTipps(root);
      /* GEFUELLT WIRD ERST, WENN DIE SEITE STEHT. Die Matrix hat einen eigenen Auftritt -- die
         Zellen ploppen diagonal herein (performance-radar.js: runAppear). Der lief bisher
         WAEHREND die Seite noch einblendete und war damit vorbei, bevor man sie sehen konnte:
         "quasi gar keine Animation". Jetzt kommt zuerst die leere Seite, dann die Daten. */
      perfNach(function(){
        perfAnsicht(root, "visibility", false);
        ohneTipps(root);
        perfNach(function(){ ohneTipps(root); hellHalten(root); }, 400);
        /* Auftritt, dann Standzeit, dann der Wechsel. Die Standzeit zaehlt NACH dem Auftritt --
           sonst ist die Haelfte davon Bewegung. */
        /* EINE Ansicht (06.10.: "streiche bei Performance den Sentiment-Step"): nach Auftritt
           und Standzeit geht die Matrix, und der Kreislauf beginnt neu. */
        perfWennGezeichnet(root, function(){
          perfNach(function(){ perfSchluss(root); }, PERF_AUF_MS + PERF_STAND_MS);
        });
      }, PERF_SEITE_MS);
    }, AUSBLENDEN_MS);
    return true;
  }

  /* ---------- Sechste Szene: Shopping (06.10. angefordert) --------------------------------
     "Folge denselben Regeln und Design-, Animations- und Dauer-Richtlinien wie bei den anderen
     Hero-Steps." Schritt fuer Schritt (Stand 06.10. spaet):
       1. die Seite, die gerade dran ist, geht (is-weg), die Leiste springt auf "shopping"
       2. nach AUSBLENDEN_MS tritt die Shopping-Seite auf -- MIT ihren Daten, die Teile
          nacheinander, die Zeilen einzeln (Begruendung unten, bei SHOP_ZEILEN)
       3. VOR_KLICK_MS Stand, dann Klick auf ein Produkt, das Detail steht STAND_MS
       4. danach die Chancen
     Alle Uhren an EINER Stelle (shopNach), damit ein Neustart keine alte mitnimmt -- dieselbe
     Lehre wie bei perfUhren.
     Die Daten sind die Antwort von cached_shopping_overview_v1 in genau ihrer Form
     (bubble/shopping_backend_vertrag.md), gefuellt mit dem Automobilmarkt der Seite: dieselben
     Marken, Farben und Produkte wie in den Karten darunter (PRODUKTE). Die Komponente bekommt sie
     ueber ihren echten Setter, so wie in der App aus dem Run-JS-Schritt. */
  /* DER AUFTRITT WIE BEI DER PROMPTS-SEITE (06.10. spaet: "die Appear-Animationen stimmen immer
     noch nicht -- erst oberer Teil, dann die Tabelle Row fuer Row, wie z.B. bei Prompts Table").
     Vorher stieg die Seite als EIN Block auf, mit ihrem Skelett, und 380ms spaeter tauschten die
     Daten das Skelett aus -- mitten im Bild, waehrend die Seite noch stieg. Jetzt kommen die Daten
     im selben Zug, in dem die Seite auftritt (wie promptsFuellen), und die Teile steigen mit
     denselben Zahlen auf wie die Prompts-Seite (landing-hero.css): Seitenkopf 0, Summary 140,
     Kennzahlen 220, Top Products 300; die Zeilen erst ab ZEILEN_START, eine je 55ms, 550ms lang.
     Der Bau im Setter (die lange Aufgabe) liegt damit VOR dem ersten Bild der Bewegung, und core
     stempelt seine Zeichen nach 250ms -- lange bevor die erste Zeile laeuft.
     Danach der Klick auf ein Produkt (06.10. abends angefordert): die Uebersicht steht
     VOR_KLICK_MS, dann wird der Home Charger angefasst und gedrueckt wie die Karte im Brett
     (FASS_MS/DRUCK_AB/DRUCK_NACH), das Detail steigt auf und steht STAND_MS -- der Takt der Runde. */
  var SHOP_ZEILEN = 10, SHOP_ZEILE_LAUF = 550, SHOP_ZEILE_STUFE = 55;
  var SHOP_ZEILEN_ENDE = ZEILEN_START + (SHOP_ZEILEN - 1) * SHOP_ZEILE_STUFE + SHOP_ZEILE_LAUF;
  /* is-kommt haelt den Tabellenkoerper verborgen, bis is-zeilen uebernimmt -- es muss also laenger
     stehen als ZEILEN_START (derselbe Grund wie bei der Prompts-Seite). */
  var SHOP_KOMMT_MS = ZEILEN_START + 240;
  /* Der Auftritt des Details: vier Teile, der letzte bei 300ms, je 680ms lang. */
  var SHOP_DETAIL_AUF = 980;
  /* Der Hover der angeklickten Zeile steht EINE SEKUNDE, bevor gedrueckt wird (06.10. nachts
     angefordert) -- laenger als die 420ms an der Karte im Brett: eine Zeile in einer Liste von
     zehn muss man erst finden, bevor der Klick etwas erklaert. */
  var SHOP_FASS_MS = 1000;
  var SHOP_FASSEN_GESAMT = SHOP_FASS_MS + DRUCK_AB + DRUCK_NACH;
  var SHOP_PRODUKT = "p2";
  var shopUhren = [];
  function shopNach(fn, ms){ shopUhren.push(setTimeout(fn, ms)); }
  function shopUhrenAus(){ shopUhren.forEach(function(u){ clearTimeout(u); }); shopUhren = []; }

  /* Je Marke: Share of Shelf, Presence, Beobachtungen, mittlere Position, Anteil Platz eins --
     jeweils [jetzt, vorher]. Acme legt zu, Tesla gibt ab, die anderen bewegen sich kaum. top ist
     das sichtbarste Produkt der Marke aus ECHTE_PRODUKTE. */
  var SHOP_MARKEN = [
    { m: "ac", sos: [31.9, 27.4], pres: [72.5, 64.8], obs: [84, 71], pos: [1.8, 2.2], erst: [46.3, 39.0], prod: 3, top: "p2" },
    { m: "te", sos: [24.6, 27.1], pres: [61.2, 66.0], obs: [65, 70], pos: [2.1, 1.9], erst: [31.5, 36.2], prod: 2, top: "p1" },
    { m: "bm", sos: [17.2, 16.5], pres: [48.9, 47.1], obs: [46, 44], pos: [2.6, 2.7], erst: [12.8, 11.9], prod: 1, top: "p4" },
    { m: "au", sos: [11.8, 12.3], pres: [36.4, 37.9], obs: [31, 33], pos: [3.1, 3.0], erst: [6.4, 7.1],   prod: 1, top: "p5" },
    { m: "vo", sos: [8.4, 9.6],   pres: [27.0, 29.8], obs: [22, 26], pos: [3.4, 3.2], erst: [3.0, 4.2],   prod: 1, top: "p8" }
  ];
  var SHOP_HAENDLER = [
    { merchant_name: "Amazon.de", observations: 58, share: 24.1, products: 9 },
    { merchant_name: "Acme Store", observations: 41, share: 17.0, products: 4 },
    { merchant_name: "Otto.de", observations: 27, share: 11.2, products: 5 }
  ];
  /* Ein Produkt in der Form der Overview (top_products, movement): Marke als Objekt, Kennzahlen
     als {value, previous, delta}, das Foto in 330px. Auch die Karten unten lesen es so. */
  function shopProdukt(p){
    function r2(x){ return Math.round(x * 100) / 100; }
    function wert(x){ return { value: x[0], previous: x[1], delta: r2(x[0] - x[1]) }; }
    var m = p.m ? handelMarke(p.m) : null;
    var marke = m ? { company_id: "lh-" + p.m, name: m.name, logo_url: m.logo, color: m.farbe, type: p.m === "ac" ? "own" : "competitor" }
                  : { company_id: null, name: p.marke || null, logo_url: null, color: null, type: "other" };
    return { source_product_id: "lh-" + p.id, title: p.t, listing_title: p.t, brand: marke, image_url: wikiBild(p.bild),
             status: p.vis[0] >= p.vis[1] ? "rising" : "declining",
             visibility: wert(p.vis), observations: wert([Math.round(p.vis[0] * 1.6), Math.round(p.vis[1] * 1.6)]),
             avg_position: wert(p.pos), first_position_rate: wert([r2(Math.max(0, 70 - p.pos[0] * 16)), r2(Math.max(0, 70 - p.pos[1] * 16))]),
             price_ranges: [{ currency: "EUR", min: p.preis[0], max: p.preis[1] }],
             rating: p.note, num_reviews: p.stimmen, merchants: ["Amazon.de", "Otto.de"].slice(0, p.haendler > 3 ? 2 : 1),
             merchant_count: p.haendler, first_seen: "2026-09-21T08:00:00+00:00", last_seen: "2026-10-04T18:00:00+00:00" };
  }
  /* Steigend und fallend nach der Aenderung der Visibility -- die drei groessten in jede Richtung. */
  function shopBewegung(){
    var mit = ECHTE_PRODUKTE.map(function(p){ return { p: p, d: p.vis[0] - p.vis[1] }; });
    var auf = mit.filter(function(x){ return x.d > 0.5; }).sort(function(a, b){ return b.d - a.d; }).slice(0, 3);
    var ab = mit.filter(function(x){ return x.d < -0.5; }).sort(function(a, b){ return a.d - b.d; }).slice(0, 3);
    return { rising: auf.map(function(x){ return shopProdukt(x.p); }), declining: ab.map(function(x){ return shopProdukt(x.p); }) };
  }
  function shopDaten(){
    function r2(x){ return Math.round(x * 100) / 100; }
    function wert(x){ return { value: x[0], previous: x[1], delta: r2(x[0] - x[1]) }; }
    var tage = [], start = Date.UTC(2026, 8, 21);
    for (var i = 0; i < 14; i++) tage.push(new Date(start + i * 864e5).toISOString().slice(0, 10));
    function marke(id){ var m = handelMarke(id) || { name: id, logo: "", farbe: "#6b7280" };
      return { company_id: "lh-" + id, name: m.name, logo_url: m.logo, color: m.farbe }; }
    var marken = SHOP_MARKEN.map(function(b, i){
      var k = marke(b.m), tp = echtesProdukt(b.top);
      k.type = b.m === "ac" ? "own" : "competitor"; k.rank = i + 1;
      k.share_of_shelf = wert(b.sos); k.presence = wert(b.pres); k.observations = wert(b.obs);
      k.avg_position = wert(b.pos); k.first_position_rate = wert(b.erst); k.products = b.prod;
      k.top_product = tp ? { source_product_id: "lh-" + tp.id, title: tp.t, image_url: wikiBild(tp.bild), visibility: tp.vis[0] } : null;
      return k;
    });
    /* Die Linien (im Fenster ausgeblendet, die Komponente zeichnet sie trotzdem): vom Wert "vorher"
       zum Wert "jetzt", mit einer kleinen, festen Welle darauf. */
    var serien = SHOP_MARKEN.map(function(b, i){
      var k = marke(b.m);
      k.is_own = b.m === "ac"; k.in_top5 = true;
      k.points = tage.map(function(tag, j){
        var t = j / 13, welle = Math.sin(j * 1.7 + i * 2.1) * 1.1;
        return { day: tag, share_of_shelf: r2(b.sos[1] + (b.sos[0] - b.sos[1]) * t + welle),
                 presence: r2(b.pres[1] + (b.pres[0] - b.pres[1]) * t + welle * 2),
                 avg_position: r2(b.pos[1] + (b.pos[0] - b.pos[1]) * t),
                 first_position_rate: r2(b.erst[1] + (b.erst[0] - b.erst[1]) * t + welle) };
      });
      return k;
    });
    var acme = marke("ac");
    var oben = ECHTE_PRODUKTE.slice().sort(function(a, b){ return b.vis[0] - a.vis[0]; });
    return {
      meta: { data_available_from: "2026-09-07",
              period: { from: tage[0], to: tage[13], requested_from: tage[0], days: 14 },
              previous_period: { from: "2026-09-07", to: "2026-09-20" }, comparison_available: true,
              own_company: acme, own_company_set: true, own_observations: 84,
              totals: { runs_with_known_state: 412, runs_with_shopping: 158, shopping_responses: 158,
                        observations: 262, responses_with_list: 141, products: ECHTE_PRODUKTE.length },
              previous_totals: { runs_with_known_state: 398, runs_with_shopping: 140, shopping_responses: 140,
                                 observations: 244, responses_with_list: 126, products: ECHTE_PRODUKTE.length - 1 } },
      kpis: { shopping_rate: wert([38.4, 35.1]), share_of_shelf: wert([31.9, 27.4]),
              avg_position: wert([1.8, 2.2]), first_position_rate: wert([46.3, 39.0]),
              brand_presence: wert([72.5, 64.8]) },
      chart: { days: tage, series: serien },
      brands: marken,
      brands_other: { company_id: null, name: null, logo_url: null, color: null, type: "other", rank: null,
                      share_of_shelf: wert([6.1, 7.1]), presence: wert([18.3, 19.0]), observations: wert([14, 15]),
                      avg_position: wert([4.2, 4.0]), first_position_rate: wert([0, 1.2]), products: 1,
                      top_product: { source_product_id: "lh-p6", title: echtesProdukt("p6").t, image_url: wikiBild(echtesProdukt("p6").bild), visibility: 12.8 } },
      brands_page: { total_count: 5, limit: 25, offset: 0 },
      brands_summary: { tracked_brands_observed: 5, unassigned_share_of_shelf: 6.1, unassigned_products: 1, own_rank: 1,
                        own_share_of_shelf: wert([31.9, 27.4]),
                        top_competitor: (function(){ var t = marke("te"); t.share_of_shelf = 24.6; return t; })() },
      top_products: oben.map(shopProdukt),
      movement: shopBewegung(),
      merchant_distribution: { top: SHOP_HAENDLER, rest: { observations: 136, share: 47.7, merchants: 9 }, merchants_total: 12 }
    };
  }
  /* Das Product Detail des Home Chargers in der Form von cached_shopping_product_detail_v1
     (bubble/shopping_backend_vertrag.md): Kopf, vier Kennzahlen, 14 Tage Verlauf, wo es erscheint,
     Haendler und die Auftritte. Die Zahlen passen zur Uebersicht davor -- Visibility 28.9 gegen
     19.2, Position 1.4 gegen 2.1, sechs Haendler, die Presence der Marke wie dort. */
  function shopDetailDaten(pid){
    function r2(x){ return Math.round(x * 100) / 100; }
    function wert(x){ return { value: x[0], previous: x[1], delta: r2(x[0] - x[1]) }; }
    function preis(v){ return { price: v, currency: "EUR", price_str: "€" + v.toFixed(2) }; }
    var ue = shopDaten(), p = echtesProdukt(pid), kopf = shopProdukt(p);
    var marke = SHOP_MARKEN.filter(function(b){ return b.m === p.m; })[0] || SHOP_MARKEN[0];
    var tage = ue.chart.days, beob = [Math.round(p.vis[0] * 1.6), Math.round(p.vis[1] * 1.6)];
    var trend = tage.map(function(tag, j){
      var t = j / 13, welle = Math.sin(j * 1.9) * 1.3;
      return { day: tag, visibility: r2(p.vis[1] + (p.vis[0] - p.vis[1]) * t + welle),
               observations: Math.max(1, Math.round((beob[1] + (beob[0] - beob[1]) * t) / 14 + Math.sin(j * 1.3))),
               avg_position: r2(p.pos[1] + (p.pos[0] - p.pos[1]) * t + Math.sin(j * 2.3) * 0.1),
               brand_presence: r2(marke.pres[1] + (marke.pres[0] - marke.pres[1]) * t + welle * 1.4),
               brand_avg_position: r2(marke.pos[1] + (marke.pos[0] - marke.pos[1]) * t) };
    });
    var haendler = [["Acme Store", 17, 37.0, 799], ["Amazon.de", 12, 26.1, 829], ["Otto.de", 8, 17.4, 849],
                    ["MediaMarkt", 5, 10.9, 899], ["Hornbach", 3, 6.5, 879], ["OBI", 1, 2.1, 869]];
    var modelle = ["chatgpt", "perplexity", "gemini", "chatgpt", "perplexity", "chatgpt"];
    var auftritte = [0, 1, 2, 3, 4, 5].map(function(i){
      var h = haendler[i % 4];
      return { prompt_run_id: "lhrun-00" + (41 - i), run_at: tage[13 - i] + "T0" + (8 + i) + ":15:00+00:00", day: tage[13 - i],
               merchant_name: h[0], model: modelle[i], market: i === 3 ? "AT" : "DE", title: p.t,
               price: h[3], currency: "EUR", price_str: "€" + h[3].toFixed(2),
               topics: [["Charging", "Pricing"], ["Charging"], ["Electric", "Charging"], ["Charging"], ["Pricing"], ["Charging"]][i],
               position: [1, 1, 2, 1, 3, 1][i], is_first: [1, 1, 2, 1, 3, 1][i] === 1, render_type: "carousel" };
    });
    kopf.listing_title = p.t + " Wallbox, Type 2, 7.5 m cable";
    kopf.images = [kopf.image_url];
    kopf.latest_price = preis(p.preis[0]);
    return {
      meta: ue.meta,
      product: kopf,
      kpis: { visibility: wert(p.vis), observations: wert(beob), avg_position: wert(p.pos),
              first_position_rate: wert([61.2, 44.8]) },
      trend: trend,
      topics: [{ tag_id: "t4", name: "Charging", responses: 31, share: 67.4 },
               { tag_id: "t1", name: "Pricing", responses: 12, share: 26.1 },
               { tag_id: "t3", name: "Electric", responses: 9, share: 19.6 }],
      models: [{ model: "chatgpt", responses: 21, share: 45.7 }, { model: "perplexity", responses: 14, share: 30.4 },
               { model: "gemini", responses: 11, share: 23.9 }],
      markets: [{ market: "DE", responses: 29, share: 63.0 }, { market: "AT", responses: 10, share: 21.7 },
                { market: "CH", responses: 7, share: 15.2 }],
      merchants: haendler.map(function(h){
        return { merchant_name: h[0], observations: h[1], share: h[2], latest_price: preis(h[3]),
                 price_ranges: [{ currency: "EUR", min: h[3], max: h[3] }] };
      }),
      appearances: { total_count: beob[0], limit: 15, offset: 0, rows: auftritte }
    };
  }
  /* Die Spalten der Produktliste im Fenster: Observations und First Position Rate fallen weg --
     mit allen sieben liefe die Tabelle in 1078px Breite seitlich hinaus. Die Auswahl liest die
     Komponente aus dem Speicher (core makeColumns, "<prefix>_cols__<instanceId>"), und zwar beim
     ERSTEN Zeichnen der Tabelle -- also hier, beim Laden der Datei, und nicht erst in der Szene. */
  try { window.localStorage.setItem("ush_cols__" + ID.ush + "__topprodukte", JSON.stringify({ obs: false, first: false })); }
  catch (e){}
  /* Die Modelle fuer Shopping: das Detail liest Name und Zeichen aus dem Modell-Speicher von core
     (UC.getModels), und ohne ihn stuende dort "Chatgpt" ohne Logo (gemessen 06.10.). In der App
     fuellt ihn Bubble; hier einmal die drei, die Shopping-Ergebnisse zeigen. Auf der Seite liest
     ihn sonst nur core selbst -- die Antwortkarte hat ihre eigene Liste (setResponsesTableModels). */
  function shopModelle(){
    if (shopModelle.an || !window.setUpstreemModels) return;
    shopModelle.an = true;
    window.setUpstreemModels(JSON.stringify([
      { key: "chatgpt", display_name: "ChatGPT", logo_url: quellzeichen("openai.com"), provider: "openai" },
      { key: "perplexity", display_name: "Perplexity", logo_url: quellzeichen("perplexity.ai") },
      { key: "gemini", display_name: "Gemini", logo_url: quellzeichen("gemini.google.com") }
    ]));
  }
  /* Die Daten in die Komponente, ueber ihren echten Setter -- im selben Zug, in dem die Seite
     auftritt (shopSzene). Der Tabellenkoerper ist bis ZEILEN_START verborgen (is-kommt). */
  function shopFuellen(root){
    shopModelle();
    if (window.setShoppingOverview){
      try { window.setShoppingOverview(ID.ush, JSON.stringify(shopDaten()), ""); }
      catch (e){ if (window.console) console.warn("[landing-hero] Shopping:", e); }
    }
    ohneTipps(root); hellHalten(root); zeichenSetzen(root);
  }
  /* Der Zaehler fuer die Staffel steht erst im AUGENBLICK von is-zeilen an den Zeilen, nicht
     beim Fuellen: die Komponente zeichnet die Tabelle nach dem Setter noch einmal (Spalten,
     Breiten), und die Zeilen danach sind andere Elemente. Gemessen im Zeitraffer: mit dem Zaehler
     aus shopFuellen kamen alle zehn Zeilen im selben Bild (1120ms) -- ohne Staffel. Derselbe
     Grund, aus dem zeilenAnsetzen bei der Prompts-Seite erst dann zaehlt. */
  function shopZeilenLos(seite){
    var zeilen = seite.querySelectorAll('[data-sek="topprodukte"] .up-tbody .up-row');
    for (var i = 0; i < zeilen.length; i++) zeilen[i].style.setProperty("--ulh-i", i);
    seite.classList.add("is-zeilen");
  }
  /* Der Klick auf ein Produkt: Hover, Druck, dann das Detail -- derselbe Ablauf wie die Karte im
     Brett (karteKlicken), nur an der Zeile. Geoeffnet wird ueber den Controller der Komponente
     (seite "detail", ohne neuen Verlaufseintrag), so wie ein Klick in der App; die Anfrage, die
     das ausloest, verpufft in der Stummschaltung (landing-boot.js), die Antwort kommt im selben
     Zug ueber den echten Setter -- das Skelett wird nie gemalt. Die Teile des Details steigen
     danach auf wie die der Uebersicht (is-detail, landing-hero.css). */
  function shopProduktKlick(root){
    var seite = root.querySelector(".ulh-shop");
    var komp = seite && seite.querySelector(".ush-root");
    var ctrl = komp && komp.__ushController;
    var zeile = seite && seite.querySelector('.ush-vorschau .up-row[data-produkt="lh-' + SHOP_PRODUKT + '"]');
    if (!ctrl || !ctrl.seite) return false;
    function oeffnen(){
      if (zeile) zeile.classList.remove("ulh-fass");
      seite.classList.add("is-detail");
      ctrl.seite("detail", false, { produktId: "lh-" + SHOP_PRODUKT });
      if (window.setShoppingProductDetail){
        try { window.setShoppingProductDetail(ID.ush, JSON.stringify(shopDetailDaten(SHOP_PRODUKT)), ""); }
        catch (e){ if (window.console) console.warn("[landing-hero] Shopping-Detail:", e); }
      }
      ohneTipps(root); hellHalten(root); zeichenSetzen(root);
      shopNach(function(){ seite.classList.remove("is-detail"); ohneTipps(root); hellHalten(root); }, SHOP_DETAIL_AUF + 120);
    }
    if (!zeile){ oeffnen(); return true; }
    zeile.classList.add("ulh-fass");
    shopNach(function(){
      zeile.classList.add("ulh-druck");
      shopNach(function(){
        zeile.classList.remove("ulh-druck");
        shopNach(oeffnen, DRUCK_NACH);
      }, DRUCK_AB);
    }, SHOP_FASS_MS);
    return true;
  }
  function shopSzene(root){
    var seite = root.querySelector(".ulh-shop");
    /* Ohne die Seite (ein aelteres Markup) geht es direkt zum Neustart -- der Kreislauf darf an
       keiner fehlenden Seite haengen bleiben. Laeuft die Szene schon, passiert nichts. */
    if (!seite){ chancenSzene(root); return false; }
    if (seite.__ulhShopAuf) return false;
    seite.__ulhShopAuf = true;
    /* Weg geht, was gerade steht -- dazu gehoert auch das Dashboard, das beim ersten Aufbau OHNE
       is-da sichtbar ist (gemessen: ein direkter Aufruf aus dem Dashboard liess es unter der
       Shopping-Seite stehen). */
    [].forEach.call(root.querySelectorAll(".ulh-seite.is-da, .ulh-main:not(.is-weg)"), function(alt){
      if (alt === seite) return;
      alt.classList.remove("is-da");
      alt.classList.add("is-weg");
    });
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "shopping");
    shopUhrenAus();
    shopNach(function(){
      seite.classList.remove("is-weg");
      seite.classList.add("is-da");
      seite.classList.add("is-kommt");
      shopFuellen(root);
      shopNach(function(){ shopZeilenLos(seite); }, ZEILEN_START);
      shopNach(function(){ seite.classList.remove("is-kommt"); }, SHOP_KOMMT_MS);
      /* Aufraeumen, sobald die letzte Zeile steht: bliebe is-zeilen haengen, liefe der Hover der
         Zeile beim Klick gegen eine noch gesetzte animation. */
      shopNach(function(){
        seite.classList.remove("is-zeilen");
        [].forEach.call(seite.querySelectorAll(".ush-vorschau .up-tbody .up-row"), function(z){ z.style.removeProperty("--ulh-i"); });
        ohneTipps(root); hellHalten(root);
      }, SHOP_ZEILEN_ENDE + 120);
      shopNach(function(){ shopProduktKlick(root); }, SHOP_ZEILEN_ENDE + VOR_KLICK_MS);
      /* Danach die Chancen: chancenSzene nimmt die Seite, die steht, selbst weg. */
      shopNach(function(){ chancenSzene(root); },
               SHOP_ZEILEN_ENDE + VOR_KLICK_MS + SHOP_FASSEN_GESAMT + SHOP_DETAIL_AUF + STAND_MS);
    }, AUSBLENDEN_MS);
    return true;
  }

  function chancenSzene(root){
    var seite = root.querySelector(".ulh-chancen");
    if (!seite || seite.__ulhChancenAuf) return false;
    seite.__ulhChancenAuf = true;
    /* Weg geht, was GERADE steht -- seit dem 06.10. ist das Shopping, nicht mehr die Prompts. */
    [].forEach.call(root.querySelectorAll(".ulh-seite.is-da"), function(alt){
      if (alt === seite) return;
      alt.classList.remove("is-da");
      alt.classList.add("is-weg");
    });
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "opportunities");
    setTimeout(function(){
      seite.classList.remove("is-weg");
      seite.classList.add("is-da");
      seite.classList.add("is-kommt");
      /* is-kommt haelt die Karten versteckt, bis is-karten uebernimmt (KARTEN_START). Es muss also
         LAENGER stehen als dieser Start, sonst stehen die Karten kurz da und verschwinden wieder.
         Derselbe Grund wie beim Tabellenkoerper der Prompts-Liste. */
      setTimeout(function(){ seite.classList.remove("is-kommt"); }, KARTEN_START + 120);
      hellHalten(root);
      /* VOR dem Fuellen: setOpportunities laesst eine offene Schublade stehen, wenn ihr Eintrag
         in den neuen Daten noch vorkommt -- und o1 kommt in jeder Runde vor. */
      schubladeZu(root);
      chancenFuellen();
      /* Nach dem Fuellen: die Karten tragen Tooltips, und das Brett baut sie in zwei Schueben. */
      ohneTipps(root);
      setTimeout(function(){ ohneTipps(root); hellHalten(root); }, 400);
      setTimeout(function(){ ohneTipps(root); }, 1200);
      kartenAnsetzen(root, seite);
      chancenAblauf(root);
    }, AUSBLENDEN_MS);
    return true;
  }

  /* ---------- Der Kreislauf ----------------------------------------------------------------
     Wenn die Schublade wieder zu ist, faengt die Sektion von vorn an: Brett weg, Dashboard zurueck,
     und die drei Wechsel danach werden neu angesetzt. Eine Sektion, die nach vierzig Sekunden
     stehenbleibt, zeigt jedem, der spaeter auf die Seite kommt, ein Standbild.

     Zurueckgesetzt wird ALLES, was den ersten Durchlauf gemerkt hat -- die Wachen an den Seiten
     (__ulh*Auf), die Wachen an der Wurzel (__ulh*An) und der Datenzustand des Dashboards. Wer eine
     davon vergisst, bekommt keinen Fehler, sondern eine Szene, die beim zweiten Mal ausfaellt.
     Nicht zurueckgesetzt wird, was EINMALIG ist: das Erscheinen des Fensters, der Scroll-Beobachter
     und die Bauteile selbst. */
  var NEUSTART_KOMMT = 1000;     /* so lange traegt die Dashboard-Seite is-kommt (der Seitenkopf, 600ms) */
  /* Ab wann die vier Kaesten im Kreislauf aufsteigen duerfen: 140ms nach dem Seitenkopf, wie
     vorher in .ulh-main.is-kommt -- vorausgesetzt, Chart und Tabelle stehen (inhaltZeigen). */
  var NEUSTART_INHALT = 140;

  function neustart(root){
    var main = root.querySelector(".ulh-main");
    var mira = root.querySelector(".ulh-mira");
    var prompts = root.querySelector(".ulh-prompts");
    var chancen = root.querySelector(".ulh-chancen");
    var perf = root.querySelector(".ulh-perf");
    var shop = root.querySelector(".ulh-shop");
    if (!main || !chancen) return false;

    /* 1. Die letzte Seite geht -- wie jeder andere Wechsel. Das ist jetzt die Performance-Seite;
       das Brett davor ist zu diesem Zeitpunkt schon weg. */
    if (perf){ perf.classList.remove("is-da"); perf.classList.add("is-weg"); }
    if (shop){ shop.classList.remove("is-da"); shop.classList.add("is-weg"); }
    chancen.classList.remove("is-da");
    chancen.classList.add("is-weg");
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "dashboard");
    /* Die vier Kaesten des Dashboards gehen JETZT auf unsichtbar, solange ihre Seite selbst noch
       unsichtbar ist (is-weg seit Mira) -- und nicht erst im Augenblick, in dem sie zurueckkommt.
       Genau dort lag das Aufblitzen (06.10. spaet gemeldet: "nach vollstaendigem Loop blitzt kurz
       das fertige Dashboard auf, verschwindet, dann legt die Animation los"). Gemessen im
       Zeitraffer-Pruefstand: die Seite blendete ein, waehrend die Kaesten von voll sichtbar
       ausblendeten (.vot-box traegt aus der Komponente "transition: opacity 200ms") -- der linke
       Chartkasten stand kurz bei 33 Prozent, war danach 1.3s weg und stieg erst dann auf. */
    root.classList.remove("is-inhalt");
    root.__ulhInhaltAn = false;

    setTimeout(function(){
      /* 2. Jede Seite zurueck auf Anfang. is-da MIT abnehmen: eine Seite, die weg ist, ist nicht
         mehr die aktuelle. */
      /* NEUTRAL, nicht is-weg. Ein Zustand ohne Klasse ist fuer diese drei Seiten schon
         unsichtbar (landing-hero.css: ".ulh-mira, .ulh-prompts, .ulh-chancen { opacity: 0 }"),
         und is-weg waere hier ein Nachtreten mit Folgen: is-weg steht in der CSS HINTER is-da und
         schlaegt es deshalb: eine Seite mit beiden Klassen bleibt unsichtbar. Genau das ist beim
         ersten Bau des Kreislaufs passiert -- in der zweiten Runde blieb Mira leer, weil
         miraSzene is-da dazusetzte, ohne das is-weg von hier abzunehmen. Gemessen an der
         Klassenliste: "mira.is-weg.is-da" bei Deckkraft 0. */
      [mira, prompts, chancen, perf, shop].forEach(function(seite){
        if (!seite) return;
        seite.classList.remove("is-da");
        seite.classList.remove("is-weg");
        seite.classList.remove("is-kommt");
        seite.classList.remove("is-zeilen");
        seite.classList.remove("is-karten");
      });
      if (mira) mira.__ulhMiraAuf = false;
      if (prompts) prompts.__ulhPromptsAuf = false;
      chancen.__ulhChancenAuf = false;
      if (perf) perf.__ulhPerfAuf = false;
      if (shop) shop.__ulhShopAuf = false;
      shopUhrenAus();
      /* Shopping vergisst seine Antwort: in der naechsten Runde zaehlen die Kennzahlen wieder
         hoch, statt fertig dazustehen. Die Anfrage, die resetShopping ausloest, verpufft in der
         Stummschaltung (landing-boot.js); die Antwort kommt erst mit der Szene. VORHER zurueck auf
         die Uebersicht: die Runde endete im Product Detail, und reset laesst die Seite stehen. */
      var shopKomp = shop && shop.querySelector(".ush-root");
      if (shopKomp && shopKomp.__ushController && shopKomp.__ushController.seite) shopKomp.__ushController.seite("overview", false);
      if (shop) shop.classList.remove("is-detail");
      if (window.resetShopping) window.resetShopping(ID.ush);
      schubladeZu(root);             /* nichts Offenes in die naechste Runde mitnehmen */
      perfUhrenAus();                /* alle Uhren der Szene anhalten */
      perfTippWeg();
      /* Die Matrix wird geleert und faengt in der naechsten Runde wieder bei der Sichtbarkeit an.
         Gewichtungsschalter UND Metrik ueberleben sonst: der Schalter liegt in der Ablage
         (uhm_weights__<id>), die Metrik in window.__uhmMetric und damit fuer die ganze Seite.
         Die zweite Runde stand deshalb von Anfang an auf Stimmung samt Balken -- die
         Sichtbarkeits-Ansicht war nie zu sehen. */
      if (window.setPerformanceRadarMetric) window.setPerformanceRadarMetric(ID.uhm, "visibility");
      if (window.setPerformanceRadarWeights) window.setPerformanceRadarWeights(ID.uhm, "no");
      if (window.resetPerformanceRadar) window.resetPerformanceRadar(ID.uhm);
      var perfKarte = root.querySelector(".ulh-perf .uhm-root");
      if (perfKarte) perfKarte.classList.remove("is-geht");
      root.__ulhMiraAn = false;
      root.__ulhSzeneAn = false;
      root.__ulhPromptsAn = false;
      root.__ulhChancenAn = false;

      /* 3. Mira leeren. Erst der Ladezustand, dann die Liste: setHasMessages haengt an BEIDEN
         ("S.messages.length > 0 || S.isLoading"), und mit noch stehendem Ladezustand bliebe die
         Chatansicht offen. Das Eingabefeld bekommt seine Deckkraft und seinen Platz zurueck,
         bevor Mira es zurueck in die Mitte faehrt -- sonst faehrt ein unsichtbares Feld. */
      var flaeche = root.querySelector(".am-composer-area");
      if (flaeche){ flaeche.style.display = ""; flaeche.style.opacity = ""; }
      var komposer = root.querySelector(".am-composer");
      if (komposer) komposer.classList.remove("is-tippt");
      var ta = root.querySelector("#am-textarea");
      if (ta){
        ta.value = "";
        try { ta.dispatchEvent(new Event("input", { bubbles: true })); } catch (e){}
      }
      if (window.askMiraSetLoading) window.askMiraSetLoading("false");
      if (window.askMiraSetMessages) window.askMiraSetMessages([]);

      /* 4. Das Dashboard wieder auf Zustand A -- Zahlen, Zeilen, Linien. fuellen() baut Chart und
         Tabelle neu; der Filterwechsel darf danach wieder laufen. */
      zustand = "a";
      try { fuellen(); } catch (e){ if (window.console) console.warn("[landing-hero]", e); }
      /* Und die Linien AUSDRUECKLICH auf Zustand A zurueck. Ohne diese Zeile blieb das Chart ab der
         zweiten Runde auf den Zahlen des Filterwechsels stehen, waehrend Tabelle und Kennzahlen
         zurueckgingen -- gemessen: Tabelle "vahakeniluve" und KPI 25 Prozent (also A), das Chart
         aber weiter ke:38.8 (also B).
         Der Grund liegt in makeLine: es merkt sich, was zuletzt GEZEICHNET wurde, und tut nichts,
         wenn dieselben Daten noch einmal kommen. Der Filterwechsel schreibt die Zahlen aber direkt
         in die Datensaetze (chartWandern -- der ganze Sinn ist, dass das Chart NICHT neu gebaut
         wird und seine Eingangsanimation nicht wiederholt), und davon erfaehrt makeLine nichts.
         Sein Gedaechtnis steht also noch auf A, waehrend die Leinwand B zeigt: die Anfrage aus
         fuellen() sieht fuer makeLine aus wie "schon da".
         Deshalb hier derselbe Weg zurueck, den der Wechsel hin genommen hat, nur ohne Dauer. */
      chartWandern(root, reihen("a"), 0);

      /* 5. Die Seite kommt zurueck -- UND ZWAR MIT DEMSELBEN AUFTRITT WIE BEIM ERSTEN LADEN
         (24.09. angefordert: "wenn die Animation einmal durchgeloopt ist, dann bitte auch beim
         naechsten Dashboard-Appear wieder der gleiche Appear-Effekt mit dem Delay und
         Hochsliden der Komponenten -- also doch in jeder Runde").
         Dafuer faellt is-inhalt ab und die Wache dazu wird zurueckgesetzt: die vier Kaesten sind
         damit wieder unsichtbar, und inhaltZeigen laesst sie gestaffelt hereinkommen, sobald das
         Chart steht. Der Textblock ueber dem Fenster bleibt unberuehrt -- er war nie weg.
         miraAnsetzen ruft inhaltZeigen dabei nicht noch einmal an: die eigene Uhr unten steht
         schon im selben Durchlauf und kommt zuerst (__ulhMiraAn). */
      /* EIN AUFTRITT, NICHT ZWEI (06.10. spaet). Bis dahin liessen ZWEI Wege die Kaesten
         aufsteigen: .ulh-main.is-kommt (landing-hero.css) und danach noch einmal is-inhalt, das
         inhaltZeigen mit der Frist des ERSTEN Ladens setzte (INHALT_FRUEH, 1410ms) -- also erst,
         nachdem is-kommt bei 1000ms abgefallen war. Dazwischen fielen die Kaesten auf unsichtbar
         zurueck. Jetzt steigt mit is-kommt nur noch der Seitenkopf, die Kaesten kommen allein
         ueber is-inhalt, NEUSTART_INHALT nach ihm -- derselbe Auftritt wie beim ersten Laden. */
      main.classList.remove("is-weg");
      main.classList.add("is-da");
      main.classList.add("is-kommt");
      setTimeout(function(){ main.classList.remove("is-kommt"); }, NEUSTART_KOMMT);
      inhaltZeigen(root, NEUSTART_INHALT);

      /* 6. Nachfassen wie beim ersten Aufbau: core stempelt neu eingefuegte Wurzeln mit dem
         gerade gueltigen Thema, die Komponenten setzen ihre Tooltips beim Zeichnen, und der
         dauerhaft offene Kasten am Chart muss wieder angesteckt werden. */
      [80, 400, 1000, 2200].forEach(function(ms){
        setTimeout(function(){
          hellHalten(root); ohneTipps(root); zeichenSetzen(root);
          schalterKuerzen(root); tippZeigen(root); mass(root);
        }, ms);
      });

      /* 7. Und die Kette neu ansetzen. Der Filterwechsel wartet von sich aus auf ein lebendes
         Chart; Mira haengt an einer festen Uhr, die hier nicht beim Erscheinen des Fensters
         beginnt, sondern beim Auftritt dieser Seite. */
      szeneAnsetzen(root);
      miraAnsetzen(root, NEUSTART_KOMMT + MIRA_WARTEN);
    }, AUSBLENDEN_MS);
    return true;
  }

  /* ---------- Der Kreislauf wartet, wenn niemand hinsieht (06.10.) --------------------------
     "Die Animationen butter smooth -- hier und da stockt noch was." Gemessen: jeder Szenenwechsel
     baut eine ganze Komponente (50 bis 120ms am Stueck auf einem schnellen Mac, beim Laden 245),
     und der Kreislauf lief weiter, auch wenn das Fenster laengst aus dem Bild gescrollt war. Wer
     dann die Karten weiter unten ansah, bekam alle zehn Sekunden einen dieser Brocken mitten in
     sein Scrollen: das Band, die Bahnen und die Auftritte laufen ueber requestAnimationFrame und
     standen fuer diese Zeit still.
     Jetzt beginnt die NAECHSTE Szene erst, wenn das Fenster zu sehen ist. Die laufende darf zu Ende
     gehen; danach wartet die Kette und laeuft weiter, sobald man zurueckscrollt -- dort, wo sie
     stand, nicht von vorn. Gemessen wird mit lage(), also auch durch den Rahmen von Framer hindurch
     (ein IntersectionObserver saehe dort alles als sichtbar). Ohne Groesse (verdeckter Tab,
     Messaufbau) haelt das Tor nichts fest. */
  function fensterImBild(root){
    var f = root && root.querySelector ? root.querySelector(".ulh-frame") : null;
    if (!f) return true;
    var l = lage(f);
    if (!l.hoch) return true;
    return l.oben < l.hoehe && l.oben + l.hoch > 0;
  }
  function mitTor(fn){
    return function(root){
      if (!root || fensterImBild(root)) return fn.apply(this, arguments);
      var self = this, args = arguments;
      /* Die juengste wartende Szene gewinnt -- es steht ohnehin immer nur eine an. */
      root.__ulhTor = function(){ return fn.apply(self, args); };
      if (!root.__ulhTorUhr){
        (function warten(){
          if (fensterImBild(root)){
            root.__ulhTorUhr = null;
            var f = root.__ulhTor; root.__ulhTor = null;
            if (f) f();
            return;
          }
          root.__ulhTorUhr = setTimeout(warten, 400);
        })();
      }
      return true;
    };
  }
  szene = mitTor(szene);
  miraSzene = mitTor(miraSzene);
  promptsSzene = mitTor(promptsSzene);
  shopSzene = mitTor(shopSzene);
  chancenSzene = mitTor(chancenSzene);
  perfSzene = mitTor(perfSzene);
  neustart = mitTor(neustart);

  /* ---------- Start ----------------------------------------------------------------------- */

  /* Warten auf die Komponenten, aber nicht endlos. Diese Datei laeuft NACH ihnen, das heisst
     aber nur, dass ihr <script>-Tag spaeter steht -- ob die Dateien schon ausgewertet sind,
     entscheidet das Netz. Ohne Warten waere der erste Setter ein TypeError auf undefined, und die
     Ausnahme haette die uebrigen mitgenommen.
     Laeuft die Uhr ab, verschwindet das FENSTER und die Sektion bleibt als Text stehen. Ein leerer
     weisser Kasten mit drei Punkten waere die schlechtere Antwort auf ein kaputtes CDN. */
  var VERSUCHE = 80, ABSTAND = 125;                        /* zusammen 10 Sekunden */

  function bereit(){
    return !!(window.UpstreemCore && window.renderVisibilityChart &&
              window.renderTopCitations && window.setDashboardPageHeaderKpis &&
              window.setSidebarTeams);
  }

  function los(root){
    /* VOR bauen(): die Prompts-Tabelle liest ihre Einstellungen beim Start aus dem localStorage,
       und der Start ist der Augenblick, in dem ihr Markup in der Seite landet. */
    promptsVoreinstellen();
    bauen(root);
    nurSchauen(root);
    /* NACH nurSchauen: das schluckt Klicks nur in .ulh-view (dem nachgebauten App-Fenster), die
       Preissektion ist davon nicht betroffen. */
    preiseBinden(root);
    nachweisBinden(root);
    radDurchlassen(root);
    scrollGroesse(root);
    hellHalten(root);
    ohneTipps(root);
    mass(root);
    /* KEIN MutationObserver auf data-theme. Der erste Versuch hatte einen: hellHalten schreibt die
       Attribute, die Komponenten HABEN darauf eigene Beobachter ("components read data-isdark in
       their own MutationObservers", core.js), reagieren mit einem Neuaufbau, und irgendwo in dieser
       Kette schrieb etwas zurueck -- der Renderer blieb stehen und beantwortete keine Abfrage mehr.
       Stattdessen ein paar feste Zeitpunkte: einmal beim Bauen, einmal nach dem Fuellen, und danach
       dreimal nachfassen. Das kann nicht kreisen, und spaeter als zwei Sekunden fasst core das
       Thema nicht mehr an. */
    /* Fuenf Zeitpunkte, nicht drei. Gemessen: core stempelt eine NEU eingefuegte .up-root mit dem
       gerade gueltigen Thema, und zwar auch ueber ein ausdruecklich gesetztes light hinweg (eigener
       Pfad, nicht der Waechter). Die Komponenten hier entstehen ueber mehrere Sekunden -- Boot-
       Puffer, Heartbeat --, also muss das Nachfassen so lange reichen. Kreisen kann es nicht: es
       sind feste Zeitpunkte, und hellHalten schreibt nur, wo der Wert abweicht. */
    [300, 900, 2000, 4000, 8000].forEach(function(ms){
      setTimeout(function(){
        hellHalten(root); ohneTipps(root); zeichenSetzen(root);
        schalterKuerzen(root); tippZeigen(root); mass(root);
      }, ms);
    });
    /* Die vier Handhaben nach draussen, an einer Stelle und SOFORT. Sie standen vorher je in dem
       Ansetzen, das sie anlegt -- und damit gab es __ulhChancen erst, nachdem die Prompts-Szene
       gelaufen war: die vierte Szene liess sich nur messen, indem man die drei davor abwartete
       (Mira allein braucht in einem verdeckten Tab weit ueber eine Minute). Debug ist das nicht:
       es sind die Ausloeser, mit denen die Landingpage ihre Szenen auch selbst schalten kann. */
    root.__ulhSzene   = function(){ return szene(root); };
    root.__ulhMira    = function(){ return miraSzene(root); };
    root.__ulhPrompts = function(){ return promptsSzene(root); };
    root.__ulhChancen = function(){ return chancenSzene(root); };
    root.__ulhPerf    = function(){ return perfSzene(root); };
    root.__ulhShop    = function(){ return shopSzene(root); };
    root.__ulhNeu     = function(){ return neustart(root); };
    /* EINE ZEILE, DIE SAGT, WORAN ES LIEGT. Sie schreibt nichts und aendert nichts -- sie zaehlt
       auf, was geladen ist, was gefuellt wurde und was leer blieb. Damit laesst sich auf der
       echten Seite in einer Zeile klaeren, ob eine Datei fehlt, ob das Fuellen geworfen hat oder
       ob die Daten da sind und nur nicht zu sehen. Ohne sie bleibt nur Raten aus der Ferne. */
    root.__ulhDiag = function(){
      function hat(n){ return typeof window[n] === "function"; }
      function inhalt(sel){
        var el = root.querySelector(sel);
        if (!el) return "FEHLT";
        var t = (el.innerText || "").replace(/\s+/g, " ").trim();
        var sk = el.querySelectorAll(".up-sk, .is-sk, [class*='skelett'], [class*='skeleton']").length;
        return t.length + " Zeichen, " + sk + " Skelette";
      }
      return {
        pin: root.getAttribute("data-cdn-pin"),
        geladen: Object.keys(window.__upAssetsLoaded || {}),
        setter: { core: !!window.UpstreemCore, vot: hat("renderVisibilityChart"),
                  tcd: hat("renderTopCitations"), dph: hat("setDashboardPageHeaderKpis"),
                  usn: hat("setSidebarTeams"), upt: hat("renderPromptsTable"),
                  uo: hat("opportunitiesSetItems"), urt: hat("renderResponsesTable"),
                  udd: hat("renderDomainDetail"), uhm: hat("renderPerformanceRadar") },
        gefuellt: root.__ulhGefuellt === true,
        bereit_nach: root.__ulhBereitNach,
        inhalte: { chart: inhalt(".vot-root"), zitate: inhalt(".tcd-root"),
                   prompts: inhalt(".upt-root"), brett: inhalt(".uo-root"),
                   antwortkarte: inhalt(".urt-root"), domain: inhalt(".udd-root") },
        auftritte: root.querySelectorAll(".ulh-auf.is-da").length + " von " +
                   root.querySelectorAll(".ulh-auf").length,
        fenster_hoehe: window.innerHeight
      };
    };
    var n = 0;
    (function warte(){
      if (bereit()){
        root.__ulhBereitNach = n;
        try { fuellen(); root.__ulhGefuellt = true; }
        catch (e){
          root.__ulhGefuellt = false;
          /* error und nicht warn: das hier ist kein Hinweis, das ist der Grund, warum die halbe
             Sektion leer bleibt. Genau so ist es am 21.09. eine Runde lang unbemerkt geblieben. */
          if (window.console) console.error("[landing-hero] fuellen() hat geworfen -- ab dieser " +
            "Stelle bleibt alles leer:", e);
        }
        hellHalten(root);
        ohneTipps(root);
        zeichenSetzen(root);
        schalterKuerzen(root);
        /* Die Leiste entsteht erst, wenn core ihre Wurzel gesehen hat -- das kann nach dem Setter
           liegen. Also nachfassen, bis sie da ist, und dann noch einmal messen. */
        (function holen(k){
          if (leisteHolen(root)){ leisteMiniHalten(root); mass(root); return; }
          if (k < 40) setTimeout(function(){ holen(k + 1); }, 100);
        })(0);
        /* Nach dem Fuellen noch einmal messen: die Tabellen bringen ihre Hoehe erst mit den
           Daten, und die Buehne muss den Ausschnitt danach immer noch fuellen. */
        mass(root);
        erscheinen(root);
        teamsLaufen(root);
        donutLaufen(root);
        taktgeber(root);
        szeneAnsetzen(root);
        /* miraAnsetzen steht NICHT mehr hier: die Uhr faengt an, wenn der Inhalt der
           Dashboard-Seite steht, und das entscheidet inhaltZeigen. */
        return;
      }
      if (++n > VERSUCHE){
        /* STILLES AUFGEBEN WAR DER FEHLER (21.09.). Hier wurde die Buehne ausgeblendet und
           zurueckgekehrt -- ohne ein Wort. Wenn eine Datei nicht ankommt (jsDelivr merkt sich
           einen fehlgeschlagenen GitHub-Abruf pro Datei und pro Commit und liefert danach 54
           Zeichen Text mit Status 200, siehe CLAUDE.md 2b), sieht man von aussen nur, dass
           "nichts geht" -- und sucht die Ursache im Code.
           Jetzt sagt die Konsole, WELCHE Setter fehlen. Das ist die Liste, aus der man in einer
           Zeile abliest, welche Datei nicht geladen hat. */
        if (window.console){
          var fehlt = [];
          if (!window.UpstreemCore) fehlt.push("core.js (UpstreemCore)");
          if (!window.renderVisibilityChart) fehlt.push("visibility-chart.js");
          if (!window.renderTopCitations) fehlt.push("topcitations-dashboard.js");
          if (!window.setDashboardPageHeaderKpis) fehlt.push("page-headers/dashboard-page-header.js");
          if (!window.setSidebarTeams) fehlt.push("sidebar.js");
          console.error("[landing-hero] Aufgegeben nach " + VERSUCHE + " Versuchen: diese Dateien " +
            "sind nicht angekommen -> " + fehlt.join(", ") + ". Das Fenster bleibt leer. Fast immer " +
            "ein Pin, dessen Dateien jsDelivr nicht ausliefert -- purgen und pruefen (CLAUDE.md 4).");
        }
        var f = root.querySelector(".ulh-stage");
        if (f) f.style.display = "none";
        return;
      }
      setTimeout(warte, ABSTAND);
    })();

    /* Neu messen, wenn sich die Breite aendert. UC ist hier noch nicht sicher da, also der eigene
       Beobachter -- und ein Rueckfall auf resize fuer alte Browser. */
    if (typeof ResizeObserver !== "undefined"){
      try { new ResizeObserver(function(){ mass(root); }).observe(root); } catch (e){}
    }
    window.addEventListener("resize", function(){
      mass(root);
      /* Das Modell-Chart setzt seine Beschriftungen bei jedem Groessenwechsel selbst neu -- und
         entscheidet dabei wieder je Zeile. Also danach erneut nach aussen holen. */
      [60, 400, 1200].forEach(function(ms){
        setTimeout(function(){ try { balkenNachAussen(root); } catch (e){} }, ms);
      });
    });
  }

  /* Das Erscheinen anstossen. is-shown BLEIBT und macht das Fenster ueberhaupt sichtbar,
     is-entering traegt die vier gestaffelten Animationen und faellt danach ab -- bliebe sie stehen,
     liefe jede spaetere Bewegung im Fenster gegen eine noch gesetzte animation.
     Die Abfallzeit MUSS hinter dem Ende der letzten Stufe liegen (ERSCHEINEN_MS, dort gerechnet),
     plus 190ms Reserve fuer einen Frame Verzug beim Klassenwechsel. Hier stand einmal 1100 -- der Wert aus der Zeit, als eine Stufe 460ms lief. Nach der
     Verlaengerung schnitt er die letzte Stufe 310ms vor ihrem Ende ab, und der Zitatblock sprang
     dabei auf seinen Endzustand. Gemessen: is-entering fiel bei 1102ms ab. */
  function erscheinen(root){
    if (root.__ulhErschienen) return;
    root.__ulhErschienen = true;
    root.classList.add("is-shown");
    root.classList.add("is-entering");
    setTimeout(function(){ root.classList.remove("is-entering"); }, ERSCHEINEN_MS + 190);
    inhaltZeigen(root);
  }

  /* ---- STUFE 2: DER INHALT KOMMT, WENN ER FERTIG IST -- NICHT, WENN EINE UHR ABLAEUFT --------
     Gemeldet: "die Appear-Animation beim ersten Load ist immer noch etwas hakelig".
     Der Grund war eine Gleichzeitigkeit: die vier Kaesten liefen auf festen Verzoegerungen los,
     waehrend Chart.js im selben Moment seine zwei Charts aufbaute. Eine Bewegung, die sonst der
     Compositor allein traegt, teilt sich dann den Hauptstrang mit Layout und Zeichnen -- und das
     sieht man.
     Also dieselbe Bedingung, auf die auch der erste Szenenwechsel wartet: eine lebende
     Chart-Instanz UND die volle Zahl an Zeilen in der Zitattabelle. Erst dann faellt is-inhalt,
     und die vier Kaesten haben die Bahn fuer sich.
     Zwei Sicherungen. Die FRUEHESTE Zeit haelt die Reihenfolge ein: der Inhalt darf nicht vor dem
     Rahmen da sein, auch wenn die Charts blitzschnell stehen. Und nach sechs Sekunden kommt er
     ohnehin -- ein Dashboard ohne Inhalt ist schlechter als eines, das nicht perfekt hereinkommt
     (kein Chart.js vom CDN, gedrosselter Tab).
     Die Uhr fuer Mira haengt hier dran und nicht mehr am blossen Erscheinen: die Ruhe vor dem
     Wechsel soll ab dem Moment zaehlen, in dem das Dashboard fertig DASTEHT. */
  /* 1150 -> 880 (24.09.: "mach den Delay etwas kleiner, das soll von oben bis unten eine schoene
     smoothe Animation sein"). Der Rahmen laeuft 690 -- 440ms nach seinem Anfang ist er zu zwei
     Dritteln durch, und der Inhalt setzt darauf auf, statt zu warten, bis alles steht.
     Seit dem 01.10. faengt der Rahmen bei 970 an statt bei 440 (der Textblock darueber ist
     langsamer), also 970 + 440 = 1410. */
  var INHALT_FRUEH = 1410;
  var INHALT_SPAET = 6000;       /* Notbremse */
  function inhaltZeigen(root, frueh){
    if (root.__ulhInhaltAn) return;
    root.__ulhInhaltAn = true;
    var start = Date.now(), fertig = false, ab = frueh == null ? INHALT_FRUEH : frueh;
    function zeigen(){
      if (fertig) return;
      fertig = true;
      root.classList.add("is-inhalt");
      miraAnsetzen(root, INHALT_MS + MIRA_WARTEN);
    }
    (function warten(){
      if (fertig) return;
      var alt2 = Date.now() - start;
      if (alt2 >= INHALT_SPAET){ zeigen(); return; }
      var leinwand = root.querySelector(".up-line-canvas");
      var lebt = leinwand && window.Chart && window.Chart.getChart && window.Chart.getChart(leinwand);
      var zeilen = root.querySelectorAll(".vot-unit-right .vt-row").length === MARKEN.length;
      if (lebt && zeilen && alt2 >= ab){ zeigen(); return; }
      setTimeout(warten, 90);
    })();
  }

  /* Sechs Sekunden nach dem Ende des Erscheinens wechselt die Sektion auf Mira. Feste Uhr und
     keine Kette an den Filterwechsel: der laeuft bei ~3200ms und ist bei ~4200 durch, es bleiben
     also mehr als drei Sekunden Ruhe dazwischen. Bleibt das Chart aus (kein Chart.js vom CDN), gibt
     es keinen Filterwechsel -- der Wechsel auf Mira soll davon aber nicht abhaengen. */
  function miraAnsetzen(root, verzug){
    if (root.__ulhMiraAn) return;
    root.__ulhMiraAn = true;
    /* Beim ersten Mal ab dem Ende des Erscheinens, im Kreislauf ab dem Auftritt der Seite -- die
       Ruhe VOR dem Wechsel soll beide Male gleich lang sein, und sie faengt an, wenn das Dashboard
       fertig dasteht. */
    setTimeout(function(){ miraSzene(root); },
               verzug == null ? (ERSCHEINEN_MS + MIRA_WARTEN) : verzug);
  }

  /* Die Szene startet erst, wenn das Dashboard WIRKLICH steht: Chart.js kommt vom CDN, und drei
     Sekunden reichen dafuer nicht immer. Waere sie vorher gelaufen, haetten sich die Zeilen
     umsortiert und die Linien nicht -- derselbe Widerspruch wie eine steigende Linie neben einem
     fallenden Pfeil, nur groesser. Zwei Bedingungen, weil beide Teile mitmuessen: eine lebende
     Chart-Instanz und die volle Zahl an Zeilen in der Tabelle. */
  function szeneAnsetzen(root){
    if (root.__ulhSzeneAn) return;
    root.__ulhSzeneAn = true;
    (function warten(k){
      var leinwand = root.querySelector(".up-line-canvas");
      var lebt = leinwand && window.Chart && window.Chart.getChart && window.Chart.getChart(leinwand);
      if (lebt && root.querySelectorAll(".vot-unit-right .vt-row").length === MARKEN.length){
        setTimeout(function(){ szene(root); }, SZENE_WARTEN);
        return;
      }
      if (k < 80) setTimeout(function(){ warten(k + 1); }, 125);
    })(0);
  }

  function start(){
    var roots = document.querySelectorAll(".ulh-root");
    for (var i = 0; i < roots.length; i++){
      if (roots[i].__ulhAuf) continue;
      roots[i].__ulhAuf = true;
      /* MIRAS GROSSE CHATLISTE BLEIBT ZU -- zu sehen ist nur die schmale Schiene daneben
         (21.09. angefordert). Mira entscheidet das beim Start aus ihrer Ablage: kein Wert und
         ein breites Fenster heisst OFFEN (seiteOffen in ask-mira.js). Genau deshalb stand auf
         der Landingpage prev-open an der Wurzel, und damit war die Schiene aus -- ihre Regel
         lautet ":not(.prev-open)".
         Der Wert wird gesetzt, BEVOR Mira mountet: ein Zumachen danach waere ein sichtbares
         Zuklappen. Der Schluessel ist der von ask-mira.js; er steht hier ein zweites Mal, weil es
         keinen Setter dafuer gibt und die Landingpage die App nicht dafuer aendern darf. */
      try { localStorage.setItem("am_side_open", "0"); } catch(e){}
      /* EINE KENNUNG AN DER WURZEL, und zwar nur fuer den Mauszeiger (21.09. angefordert: in den
         Schaustuecken soll der Zeiger nicht behaupten, man koenne hier klicken).
         Warum eine Kennung sein MUSS: die Komponenten setzen cursor: pointer teils aus Regeln mit
         eigener id (#ask-mira ...), und dagegen kommt keine reine Klassenregel an. Gemessen mit
         .ulh-app * { cursor: default }: ueber hundert Elemente im Fenster standen trotzdem auf
         pointer. Mit der Kennung reicht (1,2,0), ganz ohne !important.
         Nur setzen, wenn keine dasteht -- das Element gehoert der Seite, nicht dieser Datei. */
      if (!roots[i].id) roots[i].id = "ulh";
      los(roots[i]);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
