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

   Die Zahlen im Fenster sind DEMODATEN und die Marken sind erfunden (Kestrel, Vantage, Halden,
   Lumen, Orbit). Absichtlich: erfundene Zahlen unter echten Firmennamen wuerden auf einer
   oeffentlichen Seite wie Daten ueber diese Firmen aussehen.

   Braucht: core.js, sidebar.js, dashboard-page-header.js, visibility-chart.js,
   topcitations-dashboard.js -- und diese Datei ZULETZT, weil sie deren Setter ruft. */
(function(){
  "use strict";

  /* Feste Kennungen. Es gibt genau eine Hero-Sektion pro Seite, also braucht keine davon eine
     laufende Nummer -- und feste Namen machen die Demodaten unten lesbar. */
  var ID = { usn: "lh-usn", dph: "lh-dph", vot: "lh-vot", tcd: "lh-tcd", upt: "lh-upt",
             urt: "lh-urt", udd: "lh-udd", hph: "lh-hph", uhm: "lh-uhm" };

  /* ---- MARKUP ANFANG (erzeugt von .landing_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    usn: "<div class=\"up-root usn-root\" data-instance=\"lh-usn\" data-cdn-pin=\"\" data-isdark=\"no\" data-team-id=\"t1\" data-active=\"dashboard\" data-prompt-count=\"\" data-export-instance=\"\"></div>",
    dph: "<div class=\"up-root up-ph-root dph-root\" data-instance=\"lh-dph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span></span></div><h1 class=\"up-ph-heading\">Dashboard</h1><p class=\"up-ph-desc\">Monitor your AI visibility, performance, and latest developments</p></div><div class=\"dph-topright\"><!-- dashboard-page-header.js fills this in on setDashboardPageHeaderKpis(). --><div class=\"dph-kpis\"></div><div class=\"dph-tools\"><button class=\"dph-docsbtn\" type=\"button\" data-tip=\"Open Documentation\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v16\" /><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" /></svg><span>Docs</span></button><button class=\"dph-refreshbtn up-ph-iconbtn\" type=\"button\" aria-label=\"Refresh\" data-tip=\"Refresh Data\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" /></svg></button></div></div></div></div>",
    vot: "<div class=\"up-root vot-root\" data-instance=\"lh-vot\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"vot-unit vot-unit-left\"><div class=\"vot-head\"><div class=\"vot-heading\">Visibility over Time</div><div class=\"vot-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\" data-tip=\"Day\" aria-label=\"Day\">D</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\" data-tip=\"Week\" aria-label=\"Week\">W</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\" data-tip=\"Month\" aria-label=\"Month\">M</button></div><button class=\"vot-maximize vot-max-top vot-iconbtn\" type=\"button\" data-tip=\"Minimize\" aria-label=\"Minimize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"vot-box vot-box-left\"><div class=\"vot-panel-body\"><button class=\"vot-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"vot-unit vot-unit-right\"><div class=\"vot-head\"><div class=\"vot-heading vot-heading-right\"><span class=\"vot-head-label\">Top Brands</span><span class=\"vot-head-sep\"></span><span class=\"vot-head-count\"></span></div><div class=\"vot-head-tools\"><div class=\"vot-sort\"><button class=\"vot-sort-btn vot-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"vot-filter\"><button class=\"vot-filter-btn vot-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg><span class=\"vot-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"vot-export vot-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"vot-maximize vot-max-right vot-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button><button class=\"vot-goto vot-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" /></svg></button></div></div><div class=\"vot-box vot-box-right\"><div class=\"vt-table\"></div></div></div></div>",
    tcd: "<div class=\"up-root tcd-root\" data-instance=\"lh-tcd\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" /></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><rect x=\"7\" y=\"13\" width=\"9\" height=\"4\" rx=\"1\"/><rect x=\"7\" y=\"5\" width=\"12\" height=\"4\" rx=\"1\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-sep\"></span><span class=\"tcd-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" /></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    mqa: "<div id=\"mira-quick-actions\" data-theme=\"light\" data-team=\"\" data-cdn-pin=\"\" data-export-instance=\"\"><button class=\"mqa-trigger\" type=\"button\" aria-label=\"Open quick actions\"><svg class=\"mqa-trigger-ic\" viewBox=\"0 0 24 24\"><path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></svg><span class=\"mqa-trigger-label\">Quick Actions</span><span class=\"mqa-kbd\" data-kbd>\u2318K</span></button><div class=\"mqa-overlay\" role=\"presentation\" aria-hidden=\"true\"><div class=\"mqa-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Quick actions\"><div class=\"mqa-search\"><svg class=\"mqa-search-ic\" viewBox=\"0 0 24 24\"><path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></svg><span class=\"mqa-chips\" id=\"mqa-chips\"></span><span class=\"mqa-inputwrap\"><input class=\"mqa-input\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"\" aria-label=\"Search\" /><span class=\"mqa-ph\" id=\"mqa-ph\" aria-hidden=\"true\">Search brands, domains, URLs, prompts\u2026</span></span><span class=\"mqa-ph-cmd\" id=\"mqa-ph-cmd\" aria-hidden=\"true\">/ for filters</span><span class=\"mqa-kbd mqa-esc\" id=\"mqa-esc\">esc</span><button class=\"mqa-fav is-hidden\" type=\"button\" id=\"mqa-fav\" aria-pressed=\"false\" aria-label=\"Save as Favorite\"><svg viewBox=\"0 0 24 24\"><path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" /></svg></button><button class=\"mqa-clear is-hidden\" type=\"button\" id=\"mqa-clear\" aria-label=\"Reset search\"><svg viewBox=\"0 0 24 24\"><path d=\"M10 11v6\" /><path d=\"M14 11v6\" /><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" /><path d=\"M3 6h18\" /><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" /></svg></button></div><button class=\"mqa-entercta is-hidden\" type=\"button\" id=\"mqa-entercta\"> Press <span class=\"mqa-kbd\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 4v7a4 4 0 0 1-4 4H4\" /><path d=\"m9 10-5 5 5 5\" /></svg>Enter</span> to search </button><div class=\"mqa-scroll\"><div class=\"mqa-results\" aria-live=\"polite\"></div></div><div class=\"mqa-recent-wrap\" id=\"mqa-recent\"></div><div class=\"mqa-actions-wrap\"></div></div></div></div>",
    mira: "<div class=\"up-root am-root\" data-typespeed=\"1.15\" id=\"ask-mira\" data-instance=\"lh-mira\" data-cdn-pin=\"\" data-isdark=\"no\"><div class=\"am-shell\"><!-- ===================== HERO ===================== --><header class=\"am-hero\"><div class=\"am-hero-inner\"><div class=\"am-hero-text\"><div class=\"am-title-row\"><span class=\"am-brand\"><span class=\"am-logo-mark\" aria-hidden=\"true\"></span><span class=\"am-wordmark\">mira</span></span><span class=\"am-status-pill\" id=\"am-status-pill\"><span class=\"am-status-dot\"></span><span id=\"am-status-text\">Ready</span></span></div><p class=\"am-subline\">Chat with your AI Search data.</p></div><div class=\"am-chat-titlebar\" id=\"am-chat-titlebar\" aria-hidden=\"true\"><button class=\"am-ct-back\" id=\"am-ct-back\" type=\"button\" aria-label=\"Back to start\" data-tip=\"Back to start\"><svg viewBox=\"0 0 24 24\"><path d=\"m12 19-7-7 7-7\" /><path d=\"M19 12H5\" /></svg></button><button class=\"am-ct-name\" id=\"am-ct-name\" type=\"button\" data-tip=\"Rename chat\"><span class=\"am-ct-text\" id=\"am-ct-text\"></span><span class=\"am-ct-skeleton\" id=\"am-ct-skeleton\" aria-hidden=\"true\"></span></button><button class=\"am-ct-chev\" id=\"am-ct-chev\" type=\"button\" aria-label=\"Chat options\" aria-haspopup=\"menu\"><svg viewBox=\"0 0 24 24\"><path d=\"m6 9 6 6 6-6\" /></svg></button><input class=\"am-ct-input\" id=\"am-ct-input\" type=\"text\" maxlength=\"120\" aria-label=\"Chat name\"><span class=\"am-ct-edit-actions\" id=\"am-ct-edit-actions\"><button class=\"am-ct-mini\" id=\"am-ct-save\" type=\"button\" data-tip=\"Save\"><svg viewBox=\"0 0 24 24\"><path d=\"M20 6 9 17l-5-5\" /></svg></button><button class=\"am-ct-mini\" id=\"am-ct-discard\" type=\"button\" data-tip=\"Discard\"><svg viewBox=\"0 0 24 24\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button></span></div><button class=\"am-ghost-btn am-prev-btn\" type=\"button\" id=\"am-open-prev\"><svg viewBox=\"0 0 24 24\" class=\"am-ic am-prev-ic\"><rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"/><path d=\"M9 3v18\"/></svg><span class=\"am-prev-label-full\">All Chats</span><span class=\"am-prev-label-short\">Chats</span></button></div></header><!-- ===================== CHAT VIEW ===================== --><main class=\"am-chat\" id=\"am-chat\"><div class=\"am-messages\" id=\"am-messages\"></div><!-- Suggested questions (shown when empty) --><div class=\"am-suggested\" id=\"am-suggested\"><div class=\"am-welcome\"><h2 class=\"am-welcome-title\" id=\"am-welcome-title\">How can I help you today?</h2></div><p class=\"am-suggested-label\" id=\"am-suggested-label\">Try asking</p><div class=\"am-suggested-grid\" id=\"am-suggested-grid\"></div><div class=\"am-quick\" id=\"am-quick\" aria-label=\"Quick actions\"></div></div></main><!-- ===================== COMPOSER ===================== --><footer class=\"am-composer-area\"><button class=\"am-scroll-bottom\" type=\"button\" id=\"am-scroll-bottom\" aria-label=\"Scroll to latest\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-composer-shell\" id=\"am-composer-shell\"><div class=\"am-composer\" id=\"am-composer\"><div class=\"am-quote-slot\" id=\"am-quote-slot\"></div><div class=\"am-input-wrap\"><textarea class=\"am-textarea\" id=\"am-textarea\" rows=\"1\" maxlength=\"2800\" placeholder=\"\"></textarea><div class=\"am-ph-loop\" id=\"am-ph-loop\" aria-hidden=\"true\"><span class=\"am-ph-text\" id=\"am-ph-text\">Ask Mira...</span></div></div><div class=\"am-actions\"><button class=\"am-icon-action\" type=\"button\" id=\"am-settings-toggle\" aria-label=\"Answer settings\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" class=\"am-ic am-ic-fader\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"></path><path d=\"M19 7h-9\"></path><circle cx=\"17\" cy=\"17\" r=\"3\"></circle><circle cx=\"7\" cy=\"7\" r=\"3\"></circle></svg></button><button class=\"am-icon-action am-mic\" type=\"button\" id=\"am-mic\" aria-label=\"Voice input\"><svg viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M12 19v3\" /><path d=\"M19 10v2a7 7 0 0 1-14 0v-2\" /><rect x=\"9\" y=\"2\" width=\"6\" height=\"13\" rx=\"3\" /></svg></button><button class=\"am-send\" type=\"button\" id=\"am-send\" aria-label=\"Send message\"><svg viewBox=\"0 0 24 24\" class=\"am-ic am-ic-send\"><path d=\"m5 12 7-7 7 7\" /><path d=\"M12 19V5\" /></svg><span class=\"am-send-spinner\" aria-hidden=\"true\"></span></button></div><div class=\"am-rec\" id=\"am-rec\" aria-hidden=\"true\"><span class=\"am-rec-live\"><span class=\"am-rec-dot\"></span><span class=\"am-rec-time\" id=\"am-rec-time\">0:00</span></span><div class=\"am-rec-wave\"><canvas class=\"am-rec-canvas\" id=\"am-rec-canvas\"></canvas></div><span class=\"am-rec-spring\"></span><div class=\"am-rec-actions\"><button class=\"am-rec-btn am-rec-cancel\" type=\"button\" id=\"am-rec-cancel\" aria-label=\"Discard recording\"><svg viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button><button class=\"am-rec-btn am-rec-confirm\" type=\"button\" id=\"am-rec-confirm\" aria-label=\"Send recording\"><svg viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M20 6 9 17l-5-5\" /></svg></button></div></div></div><div class=\"am-rec-note\" id=\"am-rec-note\" role=\"status\" aria-live=\"polite\"></div><div class=\"am-settings-panel\" id=\"am-settings-panel\"><div class=\"am-settings-inner\"><div class=\"am-detail-row\"><span class=\"am-detail-label\">Answer detail</span><div class=\"am-model am-detail-dd\" id=\"am-detail\"><button class=\"am-model-btn\" type=\"button\" id=\"am-detail-btn\" aria-haspopup=\"true\" aria-expanded=\"false\" aria-label=\"Answer detail\"><span class=\"am-model-name\" id=\"am-detail-name\">Balanced</span><svg class=\"am-model-chev\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-model-menu\" id=\"am-detail-menu\" role=\"menu\"></div></div><span class=\"am-detail-tip\">Answer detail is not supported in Mira Flash</span></div><div class=\"am-model\" id=\"am-model\"><button class=\"am-model-btn\" type=\"button\" id=\"am-model-btn\" aria-haspopup=\"true\" aria-expanded=\"false\" aria-label=\"Select model\"><span class=\"am-model-ic\" id=\"am-model-ic\"></span><span class=\"am-model-name\" id=\"am-model-name\">Mira Pro</span><svg class=\"am-model-chev\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-model-menu\" id=\"am-model-menu\" role=\"menu\"></div></div></div></div></div><p class=\"am-hint\">Mira answers based on your selected workspace data.</p></footer><!-- ===================== PREVIOUS CHATS PANEL ===================== --><div class=\"am-prev-scrim\" id=\"am-prev-scrim\" hidden></div><aside class=\"am-prev-panel\" id=\"am-prev-panel\" aria-hidden=\"true\"><div class=\"am-prev-head\"><p class=\"am-prev-title\">Previous chats</p><button class=\"am-icon-btn\" type=\"button\" id=\"am-close-prev\" aria-label=\"Close\"><svg viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg></button></div><div class=\"am-prev-toolbar\"><button class=\"am-newchat\" type=\"button\" id=\"am-new-chat\"><svg viewBox=\"0 0 24 24\" class=\"am-ic\"><path d=\"M12 5v14\"></path><path d=\"M5 12h14\"></path></svg><span>New Chat</span></button><button class=\"am-settings-btn\" type=\"button\" id=\"am-settings-btn\" aria-label=\"Settings\" data-tip=\"Highlight settings\" aria-expanded=\"false\"></button></div><div class=\"am-hl-panel\" id=\"am-hl-settings-panel\"><div class=\"am-set-row\"><label class=\"am-set-label\">Brand Highlights</label><div class=\"am-dd\" id=\"am-dd-brand\" data-set=\"brand\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Citation Highlights</label><div class=\"am-dd\" id=\"am-dd-citation\" data-set=\"citation\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Icon</span><svg class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"favicon\"><span class=\"am-dd-check\"></span><span>Favicon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div><div class=\"am-set-row\"><label class=\"am-set-label\">Response Highlights</label><div class=\"am-dd\" id=\"am-dd-response\" data-set=\"response\"><button class=\"am-dd-trigger\" type=\"button\" aria-haspopup=\"listbox\" aria-expanded=\"false\"><span class=\"am-dd-value\">Logo</span><svg class=\"am-dd-chev\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\" /></svg></button><div class=\"am-dd-menu\" role=\"listbox\"><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"logo\"><span class=\"am-dd-check\"></span><span>Logo</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"icon\"><span class=\"am-dd-check\"></span><span>Icon</span><span></span></button><button class=\"am-dd-opt\" type=\"button\" role=\"option\" data-value=\"none\"><span class=\"am-dd-check\"></span><span>No Highlight</span><span></span></button></div></div></div></div><div class=\"am-prev-list\" id=\"am-prev-list\"></div></aside></div></div>",
    pph: "<div class=\"up-root up-ph-root pph-root\" data-instance=\"lh-pph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Database</span></div><h1 class=\"up-ph-heading\">Prompt Insights</h1><p class=\"up-ph-desc\">Manage Prompts, Topics and monitor latest Responses</p></div><div class=\"pph-topright\"><button class=\"up-ph-addbtn up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h14\" /><path d=\"M12 5v14\" /></svg><span>Add <span class=\"up-ph-addbtn-full\">Prompts</span></span></button><button class=\"pph-refreshbtn up-ph-iconbtn\" type=\"button\" aria-label=\"Refresh\" data-tip=\"Refresh Data\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" /></svg></button></div></div><!-- UC.makePageNav (core.js) builds the three tab items + the sliding indicator into this on init. --><div class=\"up-ph-nav\" role=\"tablist\"></div></div>",
    upt: "<div class=\"up-root upt-root\" data-instance=\"lh-upt\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\" data-sticky=\"no\" data-sticky-top=\"171\" data-export-instance=\"\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Prompts</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span><span class=\"upt-selcount\"><span class=\"upt-selcount-n\">0 selected</span><button class=\"upt-selcount-clear\" type=\"button\" aria-label=\"Clear selection\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button></span></div><div class=\"upt-status\" role=\"tablist\" aria-label=\"Prompt status\"></div><div class=\"up-head-tools\"><button class=\"upt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"upt-brand-toggle-lbl\"><img class=\"upt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"upt-brand-label\"></span></span><span class=\"upt-brand-check\"><svg class=\"upt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg><svg class=\"upt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg></span></button><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search prompts\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><span class=\"upt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-prompt is-sortable\" data-sortcol=\"prompt\"><span class=\"upt-check\" role=\"checkbox\" tabindex=\"0\" aria-checked=\"false\" data-selectall></span><span class=\"up-th-txt\">Prompt</span><span class=\"up-thsort\" data-for=\"prompt\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span><span class=\"up-grip\" data-grip=\"prompt\"></span></div><div class=\"up-th up-th-visibility is-sortable\" data-sortcol=\"visibility\"><img class=\"upt-th-brandlogo\" src=\"\" alt=\"\"/><span class=\"up-th-txt\">Visibility</span><span class=\"up-th-info\" data-explain=\"visibility\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" /></svg></span><span class=\"up-thsort\" data-for=\"visibility\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-th-info\" data-explain=\"rank\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" /></svg></span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-th-info\" data-explain=\"sentiment\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" /></svg></span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" /></svg></span></div><div class=\"up-th up-th-topics\">Topics</div><div class=\"up-th up-th-market\">Market<span class=\"up-th-info\" data-explain=\"market\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M12 16v-4\" /><path d=\"M12 8h.01\" /></svg></span></div><div class=\"up-th up-th-created is-sortable\" data-sortcol=\"created\"><span class=\"up-th-txt\">Created</span><span class=\"up-thsort\" data-for=\"created\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    oph: "<div class=\"up-root up-ph-root oph-root\" data-instance=\"lh-oph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Workspace</span></div><h1 class=\"up-ph-heading\">Opportunities</h1><p class=\"up-ph-desc\">Manage tasks, prioritize opportunities, and track progress</p></div><button class=\"up-ph-addbtn up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><circle cx=\"12\" cy=\"12\" r=\"6\" /><circle cx=\"12\" cy=\"12\" r=\"2\" /></svg><span>Generate<span class=\"up-ph-addbtn-full\"> new Opportunities</span></span></button></div></div>",
    uo: "<div class=\"up-root uo-root\" data-portal=\"inline\" data-instance=\"lh-uo\" data-cdn-pin=\"\" data-isdark=\"no\" data-sticky=\"no\" data-sticky-top=\"16\"><div class=\"up-head uo-head\"><div class=\"up-heading has-count\"><span class=\"up-head-label\">Active Opportunities</span><span class=\"up-head-sep\"></span><span class=\"up-head-count uo-total\">0</span></div><div class=\"up-head-tools\"><!-- Sorter vor der Suche: dieselbe Reihenfolge wie in allen anderen Kopfzeilen. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uo-popwrap\"><button class=\"uo-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-menu uo-sort-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Sort by</div><div class=\"up-pop-opt is-active\" role=\"menuitem\" data-sort=\"priority\">Priority<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg></div><div class=\"up-pop-opt\" role=\"menuitem\" data-sort=\"newest\">Newest<svg class=\"up-check\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg></div><div class=\"up-pop-div\"></div><div class=\"up-pop-row uo-toggle-external\"><span class=\"up-pop-label\">External only</span><span class=\"up-switch uo-switch-external\" role=\"switch\"></span></div></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search opportunities...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search opportunities\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button></div></div><div class=\"up-seg uo-mode\" role=\"tablist\" aria-label=\"View\"><button class=\"up-seg-btn is-active\" type=\"button\" role=\"tab\" data-mode=\"board\" data-tip=\"Board view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"7\" height=\"18\" rx=\"1.5\"></rect><rect x=\"14\" y=\"3\" width=\"7\" height=\"11\" rx=\"1.5\"></rect></svg>Board</button><button class=\"up-seg-btn\" type=\"button\" role=\"tab\" data-mode=\"list\" data-tip=\"List view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 5h.01\" /><path d=\"M3 12h.01\" /><path d=\"M3 19h.01\" /><path d=\"M8 5h13\" /><path d=\"M8 12h13\" /><path d=\"M8 19h13\" /></svg>List</button></div><div class=\"uo-popwrap\"><button class=\"uo-settings-btn up-iconbtn\" type=\"button\" data-tip=\"Board settings\" aria-label=\"Board settings\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><div class=\"up-menu uo-settings-pop\" role=\"menu\" aria-hidden=\"true\"><div class=\"up-pop-head\">Lanes</div><div class=\"up-pop-row\" data-board=\"pending\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#9ca3af;\"></span>Pending</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"in_progress\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#2384E2;\"></span>In Progress</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"done\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#15803d;\"></span>Done</span><span class=\"up-switch is-on\" role=\"switch\"></span></div><div class=\"up-pop-row\" data-board=\"ignored\"><span class=\"up-pop-label\"><span class=\"uo-col-dot\" style=\"background:#b4451f;\"></span>Ignored</span><span class=\"up-switch\" role=\"switch\"></span></div></div></div></div></div><!-- opportunities.js renders the lanes / list into this. --><div class=\"uo-stage\"></div><div class=\"uo-scrim\"></div><div class=\"uo-modal\" role=\"dialog\" aria-modal=\"true\"></div><!-- Optional: paste a JSON array here to render without a Run-JS step (useful while designing). --><script class=\"uo-data-json\" type=\"application/json\">[]</script></div>",
    urt: "<div class=\"up-root urt-root\" data-instance=\"lh-urt\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky=\"no\" data-sticky-top=\"171\" data-sticky=\"no\" data-default-view=\"cards\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m21 21-4.34-4.34\" /><circle cx=\"11\" cy=\"11\" r=\"8\" /></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6 6 18\" /><path d=\"m6 6 12 12\" /></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"3\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"14\" y=\"14\" rx=\"1\"/><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned?</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m18 15-6-6-6 6\" /></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\" /></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    udd: "<div class=\"up-root udd-root\" data-instance=\"lh-udd\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand=\"Kestrel\"></div>",
    hph: "<div class=\"up-root up-ph-root pfph-root\" data-instance=\"lh-hph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span> Workspace</span></div><h1 class=\"up-ph-heading\">Performance</h1><p class=\"up-ph-desc\">Explore topic performance, compare brands, and uncover strengths and gaps</p></div></div></div>",
    uhm: "<div class=\"up-root uhm-root\" data-instance=\"lh-uhm\" data-cdn-pin=\"\" data-isdark=\"no\"><div class=\"up-head\"><div class=\"up-heading\">Performance Chart</div><div class=\"up-head-tools\"><div class=\"uhm-metric up-seg\" role=\"tablist\" aria-label=\"Metric\"><button class=\"up-seg-btn is-active\" data-metric=\"visibility\" type=\"button\" role=\"tab\" aria-selected=\"true\">Visibility</button><button class=\"up-seg-btn\" data-metric=\"rank\" type=\"button\" role=\"tab\" aria-selected=\"false\">Ranking</button><button class=\"up-seg-btn\" data-metric=\"sentiment\" type=\"button\" role=\"tab\" aria-selected=\"false\">Sentiment</button></div><!-- Der Einstellungsknopf steht ganz rechts, hinter dem Filter. Er stand vorher links davon; core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uhm-pick\"><button class=\"uhm-pick-btn up-iconbtn\" type=\"button\" data-tip=\"Brands &amp; Topics\" aria-label=\"Choose brands and topics\"></button><div class=\"uhm-pick-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"uhm-set\"><button class=\"uhm-set-btn up-iconbtn\" type=\"button\" data-tip=\"Settings\" aria-label=\"Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><div class=\"uhm-set-menu up-menu\" role=\"menu\" aria-hidden=\"true\"></div></div></div></div><div class=\"uhm-box\"><div class=\"uhm-scroll\"><div class=\"uhm-grid\"></div></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  /* ---------- Demodaten ----------------------------------------------------------------- */

  /* Hoechstens sieben Zeichen je Name. Gemessen: bei 1066px Inhaltsbreite -- und die ist fest,
     weil die Buehne fest ist -- kuerzt die Top-Brands-Tabelle "Northwind" auf "Northwi...".
     Kuerzere Namen sind der billigere Hebel als eine breitere Buehne, denn die Buehnenbreite
     steuert auch die Schriftgroesse im Fenster. */
  /* Die Farben sind die Tableau-10-Reihe (4E79A7, F28E2B, E15759, 76B7B2, 59A14F, B07AA1) -- ein
     Satz, der als Satz entworfen wurde: sechs Linien in einem Chart bleiben auseinanderzuhalten,
     auch nebeneinander in einer Legende, und keine sticht heraus.
     Jede Marke hat ZWEI Zustaende. A ist der Anfang, B der Stand nach dem Filterwechsel drei
     Sekunden spaeter. Die eigene Marke (Kestrel) startet auf Platz 3 und geht auf 1 -- aufwaerts,
     nicht abwaerts, das war die Ansage. Platz 5 und 6 tauschen (Lumen und Verity).
     Die VORZEICHEN der Trendwerte sind in A und B gleich. Das ist Absicht: so muss beim Wechsel nur
     die Zahl zaehlen, und Farbe und Pfeilrichtung des Trendzeichens bleiben, wie sie sind -- ein
     Umschlagen mitten in der Bewegung waere ein Sprung, den kein Zaehlen glaettet. Verity war der
     Fall, der das erzwungen hat: es steigt von Platz 6 auf 5, also steht auch im Zustand A schon
     ein kleines Plus davor und nicht das Minus, das dort zuerst stand. */
  var MARKEN = [
    { id: "ke", name: "Kestrel", farbe: "#4E79A7",
      a: { vis: 24.6, rank: 2.4, sent: 74, visD: 2.1, rankD: -0.3, sentD: 1.4 },
      b: { vis: 38.9, rank: 1.1, sent: 79, visD: 5.8, rankD: -1.3, sentD: 3.1 } },
    { id: "va", name: "Vantage", farbe: "#F28E2B",
      a: { vis: 34.8, rank: 1.3, sent: 76, visD: 1.4, rankD: -0.1, sentD: 0.6 },
      b: { vis: 32.1, rank: 1.9, sent: 75, visD: 0.7, rankD: -0.4, sentD: 0.2 } },
    { id: "ha", name: "Halden",  farbe: "#E15759",
      a: { vis: 30.2, rank: 2.1, sent: 71, visD: 1.9, rankD: -0.2, sentD: 2.1 },
      b: { vis: 27.4, rank: 2.6, sent: 70, visD: 1.1, rankD: -0.5, sentD: 1.4 } },
    { id: "ni", name: "Nimbus",  farbe: "#76B7B2",
      a: { vis: 19.4, rank: 3.4, sent: 68, visD: -1.1, rankD: 0.4, sentD: -1.6 },
      b: { vis: 18.2, rank: 3.7, sent: 67, visD: -0.6, rankD: 0.2, sentD: -0.8 } },
    { id: "lu", name: "Lumen",   farbe: "#59A14F",
      a: { vis: 14.1, rank: 4.2, sent: 66, visD: -0.8, rankD: 0.3, sentD: 0.9 },
      b: { vis: 11.3, rank: 5.1, sent: 63, visD: -1.9, rankD: 0.7, sentD: 0.4 } },
    { id: "ve", name: "Verity",  farbe: "#B07AA1",
      a: { vis: 9.8,  rank: 5.3, sent: 63, visD: 0.6,  rankD: -0.1, sentD: 0.5 },
      b: { vis: 13.6, rank: 4.4, sent: 66, visD: 1.7,  rankD: -0.6, sentD: 1.2 } }
  ];

  /* Ein Zeichen je Marke, erzeugt: abgerundetes Quadrat in der Markenfarbe mit dem Anfangs-
     buchstaben. Die Logo-Plaetze der App bleiben sonst leer, und eine Reihe leerer grauer Kreise
     sieht nach fehlenden Daten aus.
     ECHTE Firmenlogos waeren die andere Moeglichkeit -- dann stuenden hier aber erfundene Zahlen
     unter fremden Marken, auf einer oeffentlichen Seite. Das ist eine Entscheidung und keine
     Kleinigkeit; bis dahin sind es diese.
     Als data:-Adresse und nicht als Datei: kein zusaetzlicher Abruf, und nichts kann fehlen. */
  function zeichen(text, farbe){
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
      '<rect width="32" height="32" rx="8" fill="' + farbe + '"/>' +
      '<text x="16" y="22.5" text-anchor="middle" fill="#ffffff" font-weight="600" ' +
      'font-size="16" font-family="Geist, system-ui, sans-serif">' + text + '</text></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  MARKEN.forEach(function(m){ m.logo = zeichen(m.name.charAt(0), m.farbe); });

  /* Das Zeichen einer ECHTEN Quelle. Die sechs Marken im Bild sind erfunden -- ihre Kaestchen mit
     Anfangsbuchstaben stehen darueber --, die Seiten, die KI-Antworten zitieren, sind es nicht:
     YouTube, Reddit, G2, Forbes, Wikipedia. Mit ihren richtigen Zeichen ist auf einen Blick zu
     sehen, worum es in der Zeile geht; ein graues R fuer Reddit ist eine Behauptung, die der
     Betrachter erst nachlesen muss.
     Der Dienst von Google liefert das Zeichen der Domain und fuer eine unbekannte einen
     Weltkugel-Rueckfall -- er antwortet also immer, und die Komponenten haben zusaetzlich ihr
     eigenes onerror (opportunities.js: favHtml, topcitations-dashboard.js). Keine eigene Kopie
     der Dateien: die waere am Tag ihrer Aufnahme richtig und danach veraltet. */
  function quellzeichen(domain){
    return "https://www.google.com/s2/favicons?sz=64&domain=" + encodeURIComponent(domain);
  }

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
     UC.granAvailability von sich aus "Day" (ueber 92 Tagen unlesbar) und gibt Week und Month frei.
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

  /* Erfundene Quellen. Keine echten Domains: die Anteile hier sind Demozahlen, und unter einem
     echten Namen saehen sie aus wie eine Aussage ueber diese Seite. */
  /* Die Zitattypen sind die ECHTEN der App -- UC.ALL_CITATION_TYPES: Editorial, UGC_Community,
     Knowledge_Base, Brand_Platform, Institutional, Competition, You. Vorher standen hier erfundene
     Namen (Review, Comparison, Owned, News); die Komponente faerbt und beschriftet aber nach dieser
     Liste, ein unbekannter Name laeuft in den Rueckfall. Sechs der sieben stehen unten; nur
     Institutional faellt weg, seit die fremden Domains echte sind (eine Universitaet oder eine
     Behoerde mit erfundenen Zahlen daneben waere die eine Zeile, die sich als Aussage ueber diese
     Einrichtung lesen liesse). Editorial kommt dafuer zweimal vor -- die Spalte darf sich
     wiederholen, der Kuchen daneben zaehlt ohnehin ALLE Zitate und nicht diese sieben Zeilen. */
  /* Die FREMDEN Quellen sind echt, die EIGENEN nicht -- und das ist nicht Zufall, sondern die
     einzige Aufteilung, die aufgeht: forbes.com, reddit.com, wikipedia.org und g2.com zitieren
     wirklich, und ihr Zeichen erkennt jeder. Die Zeilen mit dem Typ "You" und "Competition"
     gehoeren dagegen den erfundenen Marken dieses Bildes (Kestrel, Vantage) -- eine echte Domain
     daneben behauptete, das Konto gehoere dieser Firma. Sie tragen deshalb das Markenkaestchen,
     das auch in der Markentabelle darueber steht: dieselbe Farbe, derselbe Buchstabe, und damit
     ist die Zeile sofort der eigenen Marke zuzuordnen. */
  var QUELLEN = [
    { domain: "forbes.com",           share_pct: 18.4, share_delta_pct: 2.1,  used_total: 2926, citation_type: "Editorial" },
    { domain: "reddit.com",           share_pct: 14.1, share_delta_pct: -1.3, used_total: 2242, citation_type: "UGC_Community" },
    { domain: "wikipedia.org",        share_pct: 11.7, share_delta_pct: 0.8,  used_total: 1860, citation_type: "Knowledge_Base" },
    { domain: "kestrel.example",      share_pct: 9.3,  share_delta_pct: 3.4,  used_total: 1479, citation_type: "You",
      logo: MARKEN[0].logo },
    { domain: "vantage.example",      share_pct: 7.6,  share_delta_pct: -0.4, used_total: 1208, citation_type: "Competition",
      logo: MARKEN[1].logo },
    { domain: "docs.kestrel.example", share_pct: 6.2,  share_delta_pct: 1.9,  used_total: 986,  citation_type: "Brand_Platform",
      logo: MARKEN[0].logo },
    { domain: "g2.com",               share_pct: 4.8,  share_delta_pct: -0.7, used_total: 763,  citation_type: "Editorial" }
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
     Danach kommt hellHalten und setzt data-theme AUSDRUECKLICH auf "light" -- core nimmt es fuer
     hell naemlich weg, und ohne das Attribut gilt wieder, was der Rechner des Besuchers
     eingestellt hat. */
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
         einen eigenen Wert braucht. Reihenfolge darin: blaues Bild hinten, Onboarding-Grafik
         davor. */
      '<div class="ulh-bg" aria-hidden="true">' +
        '<span class="ulh-bg-foto"></span>' +
        '<span class="ulh-bg-grid"></span>' +
      '</div>' +
      '<div class="ulh-text">' +
        '<p class="ulh-eyebrow">' +
          '<span class="ulh-chip"><span class="ulh-chip-in">Get mentioned in AI search</span></span>' +
        '</p>' +
        '<h1 class="ulh-h1"><span>AI Search Analytics</span><span>Made simple.</span></h1>' +
        /* Der Umbruch nach "drive" steht hier und nicht in der CSS: die drei Treiber sollen zu
           dritt in einer Zeile stehen, und das ist eine Aussage ueber den Text, nicht ueber die
           Breite. Die Zeichen setzt zeichenSetzen() nach, sobald core da ist. */
        '<p class="ulh-sub">Track and optimize your brand’s AI search performance and drive' +
          '<span class="ulh-drivers">' +
            '<span class="ulh-driver" data-ic="chartColumnUp">Qualified Traffic</span>' +
            '<span class="ulh-driver" data-ic="users">Leads</span>' +
            '<span class="ulh-driver" data-ic="dollarSign">Revenue</span>' +
          '</span>' +
        '</p>' +
        '<div class="ulh-cta">' +
          '<button class="ulh-btn ulh-btn-sec" type="button">Talk to Sales</button>' +
          '<button class="ulh-btn ulh-btn-pri" type="button">Book a Demo</button>' +
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
              '<div class="ulh-seiten">' +
                '<div class="ulh-seite ulh-main">' +
                  (MARKUP.dph || "") + (MARKUP.vot || "") + (MARKUP.tcd || "") +
                '</div>' +
                '<div class="ulh-seite ulh-mira">' + (MARKUP.mira || "") + '</div>' +
                '<div class="ulh-seite ulh-prompts">' +
                  (MARKUP.pph || "") + (MARKUP.upt || "") +
                '</div>' +
                '<div class="ulh-seite ulh-chancen">' +
                  (MARKUP.oph || "") + (MARKUP.uo || "") +
                '</div>' +
                /* Fuenfte Seite: Performance. Sie steht am Ende des Kreislaufs, weil sie die Frage
                   beantwortet, die nach den Chancen kommt -- "und wo stehe ich je Thema?". */
                '<div class="ulh-seite ulh-perf">' +
                  (MARKUP.hph || "") + (MARKUP.uhm || "") +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        fensterUrls() +
        '</div>' +
      '</div>' +
      '</section>' +
      merkmale() +
      quellen() +
      msc() +
      geo() +
      stimme() +
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
      '</div>' +
    '</footer>';
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
      { q: "What are people saying about Kestrel right now?",
        titel: "Sentiment, last 30 days",
        werkzeuge: ["brand_overview", "source_mentions_overview"],
        dauer: 14000,
        html: '<p>' + markeChip("ke") + ' sits at <strong>79 / 100</strong> sentiment over the last ' +
          '30 days, up 3.1 points. The praise is consistent:</p>' +
          '<p><span data-mira-sentiment="positive">"Kestrel is the fastest of the three to set up, ' +
          'and the only one that shows which page an answer came from."</span></p>' +
          '<p>The quote is from ' + miraChip("response", "r1", "ChatGPT, Aug 24") +
          '; most of the positive mentions trace back to ' + quelleChip(0) + '.</p>' },

      { q: "What should I fix first this week?",
        titel: "This week's priorities",
        werkzeuge: ["prompt_insights", "source_recommendations"],
        dauer: 21000,
        html: '<p>Three things, highest lift first:</p><ul>' +
          '<li>Get listed on ' + quelleChip(0) + ' - it decides five of your comparison prompts.</li>' +
          '<li>Answer the pricing thread on ' + quelleChip(1) + ' - ' + markeChip("va") +
          ' is named there, you are not.</li>' +
          '<li>Ship a pricing page: your weakest topic at <strong>22%</strong>.</li></ul>' +
          '<p>Estimated lift: <strong>+5 to 8 points</strong> in 30 days.</p>' },

      { q: "Which sources decide who gets named?",
        titel: "Sources behind the answers",
        werkzeuge: ["citation_overview", "response_mentions"],
        dauer: 18000,
        /* Der Satz steht VOR der Tabelle und nicht dahinter: eine Zeile statt zwei, und die
           Antwort passt damit in die Chatflaeche. Nach der Tabelle brauchte er zwei Zeilen. */
        html: '<p>Two pages decide most of it, and neither is yours:</p>' +
          '<table><thead><tr><th>Source</th><th>Share</th><th>Names</th></tr></thead><tbody>' +
          '<tr><td>' + quelleChip(0) + '</td><td>31.4%</td><td>' + markeChip("va") + '</td></tr>' +
          '<tr><td>' + quelleChip(1) + '</td><td>18.2%</td><td>' + markeChip("ha") + '</td></tr>' +
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
      '</style></head><body>' + (MARKUP.mira || "") +
      '<script src="' + basis + 'core.js"><\/script>' +
      '<script src="' + basis + 'ask-mira.js"><\/script>' +
      '<script>' +
        /* HELL, und ueber den Setter: ask-mira.js nimmt data-theme beim Start ab und faellt sonst
           auf prefers-color-scheme zurueck -- auf einem dunkel gestellten Rechner stuende hier
           sonst eine schwarze Komponente in einer hellen Seite. Die Schleife, weil der Setter erst
           existiert, wenn ask-mira.js gelaufen ist. */
        '(function(){var n=0;(function go(){if(window.askMiraSetTheme){' +
        'window.askMiraSetTheme("light");return;}if(n++<60)setTimeout(go,50);})();})();' +
        /* Sehen ja, bedienen nein -- in der Abfangphase, bevor die Komponente es sieht. Ein
           pointer-events: none am Rahmen haette auch das Hovern mitgenommen. */
        /* Das Mausrad gehoert der SEITE. ask-mira haengt einen eigenen Radgriff an den Chat, der
           scrollt und dann preventDefault ruft -- in der App richtig, hier steht damit alles: der
           Chat scrollt nicht (er passt), und die Seite darunter auch nicht mehr. Der Griff wird in
           der Einfangphase gestoppt, bevor er ueberhaupt laeuft; ohne preventDefault reicht der
           Browser das Rad an das Fenster darueber weiter. */
        'document.addEventListener("wheel",function(e){e.stopPropagation();},true);' +
        'document.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();},true);' +
        'document.addEventListener("keydown",function(e){e.preventDefault();e.stopPropagation();},true);' +
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
  var MSC_HALTEN_MS  = 7600;   /* wie lange die fertige Antwort steht */
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
      var antwort = { id: "msc-a", role: "assistant", status: "success", created_at: jetzt,
                      content_html: f.html, evidence_items: miraBelege(), latency_ms: f.dauer };

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
        planen(meine, naechster, MSC_HALTEN_MS);
      }, denkt);
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
        tippen(meine, f.q, function(){ klicken(meine, function(){ fall(meine, f); }); });
      }, MSC_LEER_MS);
    }

    /* Handhabe zum Nachsehen: einen Fall sofort zeigen, ohne das Tippen abzuwarten. Sie schreibt
       nichts, was der Lauf nicht ohnehin schriebe -- sie ueberspringt nur die Eingabe. */
    fr.__ulhFall = function(k){ var meine = ++lauf; leeren(); fall(meine, faelle[k % faelle.length]); };
    fr.__ulhFaelle = faelle;     /* zum Nachmessen: die Antworten ohne Lauf und ohne Tippen setzen */

    /* Erst anfangen, wenn die Komponente im iframe wirklich steht. */
    var versuche = 0;
    (function warten(){
      if (d.querySelector("#am-textarea") && w.askMiraSetMessages){ naechster(); return; }
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
  var MERKMALE = [
    { breit: 40, vis: "linie",
      h: "Track your visibility over time",
      p: "See how often each model names your brand, in which position, and with what sentiment. " +
         "Side by side with the competitors you track." },
    { breit: 60, vis: "zeilen",
      h: "See which questions you show up for",
      p: "Every answer starts with a question someone asked. Track the ones that matter in your " +
         "market, grouped by topic, and see where you are named and where you are not." },
    { breit: 60, vis: "domains",
      h: "Find the sources behind the answers",
      p: "Answers are built from pages. See which domains get cited in your category, and open " +
         "one to see the exact pages behind it." },
    { breit: 40, vis: "chancen",
      h: "Get a list of what to fix",
      p: "Upstreem turns the gaps into concrete tasks: a listing to get, a page to write, one to " +
         "improve. Each with the numbers behind it." },
    /* Reihe drei, 50/50. Die zwei Karten beantworten die Fragen, die nach den ersten vier kommen:
       "gilt das auch fuer meinen Markt?" und "gilt das fuer alle Modelle?". */
    { breit: 50, vis: "sprachen",
      h: "Monitor LLMs in any language, from any country",
      p: "Track the questions your buyers actually ask, in their language and their market. " +
         "Volumes and rankings are reported per market, not averaged into one number." },
    { breit: 50, vis: "modelle",
      h: "Daily AI response tracking across multiple models",
      p: "Every prompt runs against each model, every day. You see where the answers agree, " +
         "where they differ, and which model names you first." }
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
    { m: "US", t: "best AI visibility tools for B2B SaaS",              v: 88 },
    { m: "DE", t: "welches Tool zeigt Markenerwähnungen in ChatGPT",    v: 47 },
    { m: "FR", t: "meilleur outil de suivi de visibilité IA",           v: 39 },
    { m: "GB", t: "how to track brand mentions in AI answers",          v: 74 },
    { m: "IT", t: "come monitorare il brand nelle risposte AI",         v: 24 },
    { m: "US", t: "how do LLMs decide which brands to recommend",       v: 68 },
    { m: "DE", t: "wie werde ich in KI-Antworten sichtbar",             v: 36 },
    { m: "FR", t: "comment être cité par ChatGPT",                      v: 29 },
    { m: "GB", t: "AI search monitoring pricing compared",              v: 52 },
    { m: "IT", t: "strumenti per la visibilità AI a confronto",         v: 18 },
    { m: "US", t: "which sources does ChatGPT cite for software",       v: 61 },
    { m: "DE", t: "KI-Sichtbarkeit messen Agentur oder Tool",           v: 21 },
    { m: "FR", t: "quelles sources citent les modèles IA",              v: 16 },
    { m: "GB", t: "share of voice across AI assistants",                v: 44 },
    { m: "IT", t: "quali fonti cita Perplexity in Italia",              v: 12 }
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
  var MERKMAL_H = "What upstreem shows you";
  var MERKMAL_SUB = "AI assistants answer your buyers’ questions every day. upstreem tracks " +
    "what they say about your brand, which sources those answers come from, and what to change " +
    "so you show up more often.";

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
     eine, die stehenbleibt. Kestrel geht von 18.2 auf 38.9 (dieselbe 38.9 wie im Fenster oben),
     Vantage von 34.8 auf 32.1. */
  /* hoch: ein zusaetzlicher Versatz nach oben. Die Lage des Schildes wird aus dem Wert der Kurve
     an seiner Stelle gerechnet, und zwar LINEAR zwischen zwei Punkten -- die gezeichnete Kurve ist
     aber gerundet (tension 0.38) und woelbt sich auf einem steigenden Stueck nach oben. Beim
     Schild der eigenen Marke, das auf dem steilsten Stueck sitzt, sind das rund 16px: der Strich
     endete darunter im Leeren. Ein fester Versatz statt einer Bezier-Rechnung, weil genau eine
     Stelle betroffen ist. */
  var KRV = [
    { id: "va", schild: 1, hoch: 0,  werte: [26.1, 25.4, 24.8, 25.1, 24.2, 23.9] },
    { id: "ke", schild: 5, hoch: 16, werte: [18.2, 19.1, 22.6, 28.4, 34.2, 38.9] }
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
  var VIS_ZEILEN = [
    { prompt: "Best AI visibility tools",         vis: 38.9, rank: 1.1,  sent: 79,   themen: [0, 3], markt: "US" },
    /* Die zweite Zeile ist die, die beim Ueberfahren gehoben wird -- sie traegt deshalb Zahlen.
       Der Leerzustand steht in der dritten. */
    { prompt: "AI search monitoring pricing",     vis: 21.4, rank: 2.8,  sent: 68,   themen: [1],    markt: "US" },
    { prompt: "Alternativen zu Vantage",          vis: null, rank: null, sent: null, themen: [2, 4], markt: "DE" },
    { prompt: "Tools to track ChatGPT mentions",  vis: 18.2, rank: 3.2,  sent: 71,   themen: [3],    markt: "UK" },
    { prompt: "Which platform tracks Perplexity", vis: null, rank: null, sent: null, themen: [0, 1], markt: "US" }
  ];

  function visZeilen(){
    var kern = window.UpstreemCore;
    /* Die Reihenfolge der Spalten ist die der App: Prompt, Visibility, Rank, Sentiment, Topics,
       Market. Visibility fehlte in der ersten Fassung ganz -- und sie ist die Zahl, um die es in
       dieser Karte geht. Die Spalte "Mentioned" faellt dafuer weg: eine leere Visibility sagt
       dasselbe, und sechs Spalten sind in dieser Breite die Grenze. */
    var kopf = ["Prompt", "Visibility", "Rank", "Sentiment", "Topics", "Market"];
    /* Die Spalten stehen als --up-cols am Kasten: .up-row ist ein Raster und liest sie von dort.
       Ohne diese Angabe erbt die Zeile die Spalten der zuletzt definierten Tabelle. */
    /* Topics 260: zwei Chips brauchen zusammen bis zu 215px, dazu 28 Polster der Zelle. Bei 200
       waren die Beschriftungen um 7 bis 32px abgeschnitten (gemessen). */
    /* Die Prompt-Spalte bekommt mehr Platz: sie ist die einzige, die man wirklich LIEST, und die
       anderen fuenf zeigen Zahlen und Zeichen. Genommen wird es von den vier festen Spalten und
       von den Themen (260 -> 210, ein Chip ganz und der zweite angeschnitten -- in einer Vorschau
       ist das genug). Gerechnet: die festen Spalten waren zusammen 648, jetzt 570; auf einer
       838px breiten Vorschau waechst die Prompt-Spalte damit von 190 auf 268. */
    var html = '<div class="ulh-vis-tab" style="--up-cols: minmax(0,1fr) 96px 84px 96px minmax(0,210px) 84px;">' +
      '<div class="up-row up-thead">' + kopf.map(function(t){
        return '<div class="up-td">' + t + '</div>'; }).join("") + '</div>';
    html += VIS_ZEILEN.map(function(z, i){
      var leer = '<span class="up-num is-empty">–</span>';
      var sicht = z.vis == null ? leer
        : '<span class="up-num">' + eine(z.vis) + '%</span>';
      var sent = z.sent == null
        ? '<span class="up-sent"><span class="up-sent-val is-empty">–</span></span>'
        : '<span class="up-sent"><span class="up-sent-dot" style="background:' +
          (kern ? kern.sentColor(z.sent) : "#999") + '"></span>' +
          '<span class="up-sent-val">' + z.sent + '</span></span>';
      var rank = z.rank == null ? leer
        : '<span class="up-rank-group">' + (kern ? kern.HASH_ICON : "") +
          '<span class="up-num">' + z.rank.toFixed(1) + '</span></span>';
      /* Die Themenchips sind .up-topicchip aus core -- dieselben wie in der Prompts-Tabelle oben,
         gefaerbt aus derselben Themenliste. */
      var themen = z.themen.map(function(ti){
        var t = THEMEN[ti % THEMEN.length];
        return '<span class="up-topicchip" style="--ust-tag-color:' + (t.hex_light || "#6b7280") + ';">' +
          (t.emoji ? '<span class="up-topicchip-e">' + t.emoji + '</span>' : "") +
          '<span class="up-topicchip-lbl">' + t.name + '</span></span>';
      }).join("");
      return '<div class="up-row' + (i === 1 ? " is-mitte" : "") + '">' +
        '<div class="up-td"><span class="ulh-vis-prompt">' + z.prompt + '</span></div>' +
        '<div class="up-td">' + sicht + '</div>' +
        '<div class="up-td">' + rank + '</div>' +
        '<div class="up-td">' + sent + '</div>' +
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
    { url: "https://www.reddit.com/r/SaaS/comments/1a2b3c/best_ai_visibility_tools/", anteil: 24.6, typ: "forum", gesehen: "Aug 27, 2026" },
    { url: "https://www.reddit.com/r/marketing/comments/2b3c4d/how_we_track_chatgpt_mentions/", anteil: 18.2, typ: "forum", gesehen: "Aug 26, 2026" },
    { url: "https://www.reddit.com/r/SEO/comments/3c4d5e/geo_vs_seo_in_2026/", anteil: 12.9, typ: "forum", gesehen: "Aug 24, 2026" },
    { url: "https://www.reddit.com/r/SaaS/comments/4d5e6f/pricing_comparison_thread/", anteil: 9.4, typ: "forum", gesehen: "Aug 22, 2026" },
    { url: "https://www.reddit.com/r/bigseo/comments/5e6f7g/ai_overviews_and_traffic/", anteil: 7.1, typ: "forum", gesehen: "Aug 21, 2026" }
  ];

  function visDomains(){
    var kern = window.UpstreemCore;
    function tag(typ, modus){
      if (!kern || !kern.typeColor) return "";
      var farbe = kern.typeColor(typ, modus, false);
      var name = modus === "url" ? (kern.URL_LABEL[typ] || typ) : kern.citeName(typ);
      /* Dieselbe Pille wie in der Zitattabelle: Punkt in der Typfarbe, Grund derselbe Ton mit
         wenig Deckkraft. Die Werte kommen aus core (typeColor), nicht von hier. */
      return '<span class="tct-tag" style="background:' + farbe + '1f;color:' + farbe + '">' +
        '<span class="tct-tag-dot" style="background:' + farbe + '"></span>' +
        '<span class="tct-tag-lbl">' + name + '</span></span>';
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
            /* Das Zeichen kommt ueber data-ic nach (zeichenSetzen), nicht ueber kern.icon: diese
               Funktion laeuft beim BAUEN, und da ist core noch nicht sicher da -- gemeldet als
               "da fehlen noch die chevron down bei den x pages". */
            '<button class="up-pages udt-pagesbtn' + (d.offen ? " is-open" : "") + '" type="button" tabindex="-1">' +
              '<span class="udt-pagesbtn-lbl">' + d.seiten + ' pages</span>' +
              '<span class="udt-chev" data-ic="chevronDown" data-ic-w="2.2"></span>' +
            '</button>' +
          '</span>' +
        '</div>' +
        '<div class="up-td up-td-share"><span class="udt-num">' + eine(d.share) + '%</span>' +
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
                  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>' +
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
            '<span class="udt-sub-share">' + eine(u.anteil) + '%</span>' +
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
    { h: "Get listed on the g2.com category page", dom: "g2.com", pot: 4, themen: [0] },
    { h: "No page of yours answers the pricing question", dom: "reddit.com", pot: 3, themen: [1] },
    { h: "Your integrations page is cited, never quoted", dom: "kestrel.example", pot: 2, themen: [2] },
    { h: "Show up in the comparison videos", dom: "youtube.com", pot: 3, themen: [3] },
    { h: "Add your entry to the wikipedia category", dom: "wikipedia.org", pot: 2, themen: [4] },
    { h: "Answer the migration question on your blog", dom: "kestrel.example", pot: 3, themen: [0] }
  ];

  function visChancen(){
    var kern = window.UpstreemCore;
    return '<div class="ulh-vis-chancen"><div class="uo-list-rows">' +
      VIS_CHANCEN.map(function(c, i){
        var logo = c.dom.indexOf("kestrel.example") >= 0 ? MARKEN[0].logo : quellzeichen(c.dom);
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

  function merkmalKarte(m, i){
    return '<article class="ulh-card ulh-auf" style="--ulh-w:' + m.breit + ';--auf:' + (i || 0) + '">' +
      '<h3 class="ulh-card-h">' + m.h + '</h3>' +
      '<p class="ulh-card-p">' + m.p + '</p>' +
      '<div class="ulh-vis ulh-vis-' + m.vis + '" data-ulh-vis="' + m.vis + '">' +
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
          return { data: k.werte, borderColor: marken[i].farbe, __farbe: marken[i].farbe,
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

  /* ---------- Dritte Sektion: die Quellen ----------------------------------------------------
     Aufbau wie die Vorlage, an der sich diese Seite orientiert: farbiger Chip, EINE grosse
     Ueberschrift in zwei Toenen (der erste Satz dunkel, der Rest in der zweiten Farbe), ein Knopf,
     und darunter ein Stueck der App -- angeschnitten, nicht als Bild in einem Rahmen. Die Sektion
     zeigt genau eine Sache: was hinter einer Antwort steckt, am Beispiel einer Domain.

     Die Domain ist g2.com und nicht erfunden: die Sektion behauptet nichts ueber diese Seite,
     sondern zeigt, WAS die App ueber eine Quelle weiss -- und ein erfundener Name waere hier das
     Gegenteil von dem, was gemeint ist ("die echten Quellen deines Marktes"). Die Zahlen sind
     Beispielzahlen und stehen in derselben Groessenordnung wie im Dashboard darueber. */
  var QUELL_CHIP = "Source Insights";
  var QUELL_H1 = "Understand how sources shape answers.";
  var QUELL_H2 = "Which domains the models cite in your market, which of their pages carry the " +
    "answer, and where your brand is named in them.";
  var QUELL_CTA = "Start for free";
  var QUELL_DOMAIN = "g2.com";

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
  function schriftTakt(h, buchstaben){
    var l = lage(h);
    /* 0, wenn die Oberkante noch bei 92 Prozent der Fensterhoehe steht; 1, wenn sie 52 Prozent
       weiter gewandert ist -- also etwa in der Mitte des Fensters. */
    var p = (l.hoehe * 0.92 - l.oben) / (l.hoehe * 0.52);
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
              '<span class="up-logo-ltr">G</span>' +
            '</span>' +
            '<span class="ulh-quell-domtxt">' +
              '<span class="ulh-quell-domname">' + QUELL_DOMAIN + '</span>' +
              '<span class="ulh-quell-domsub">Review platform &middot; cited in your market since January</span>' +
            '</span>' +
          '</div>' +
          '<div class="ulh-quell-app up-root" data-theme="light" data-isdark="no" data-up-keepclip>' +
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
  function quellFuellen(){
    /* Erst das Thema, dann die Daten: die Charts nehmen ihre Farben beim Zeichnen, und das
       passiert im selben Zug wie das Setzen der Daten. */
    themaHell();
    var wurzel0 = document.querySelector(".ulh-root");
    if (wurzel0) hellHalten(wurzel0);
    window.__uddMode = window.__uddMode || {};
    window.__uddMode[ID.udd] = "domain";
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
  function tippWachen(){
    var uhr = setInterval(function(){
      var wurzel = document.querySelector('.udd-root[data-instance="' + ID.udd + '"]');
      if (!wurzel){ clearInterval(uhr); return; }
      var tt = wurzel.querySelector(".up-line-tt");
      if (!tt || tt.style.opacity === "0" || tt.style.opacity === "") tippSetzen();
    }, 1500);
  }

  /* ---- Die Daten der Beispiel-Domain ----
     Sieben Tage, fuenf Seiten. Gerechnet und nicht gewuerfelt: bei jedem Laden dasselbe Bild, und
     die Zahlen haengen zusammen -- der Tagesanteil schwankt um den Grundwert der Seite, und die
     Summe der fuenf bleibt unter dem Domainanteil. */
  var QUELL_TAGE = ["2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15",
                    "2026-08-16", "2026-08-17", "2026-08-18"];
  var QUELL_SEITEN = [
    { p: "/categories/ai-visibility", t: "Best AI Visibility Software in 2026 | G2", b: 6.2 },
    { p: "/products/upstreem/reviews", t: "upstreem Reviews 2026: Details, Pricing & Features | G2", b: 4.4 },
    { p: "/compare/upstreem-vs-vantage", t: "Compare upstreem vs Vantage 2026 | G2", b: 3.1 },
    { p: "/categories/seo-tools", t: "Best SEO Tools in 2026 | G2", b: 2.3 },
    { p: "/grid/ai-search-monitoring", t: "G2 Grid for AI Search Monitoring | G2", b: 1.6 }
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
         Die Verteilung passt zu dem, was G2 wirklich ist: Kategorieseiten (Listicle), Produkt-
         bewertungen (Review), Vergleiche (Comparison), das Grid als Verzeichnis (Directory). */
      types_breakdown: [
        { type: "listicle", share_pct: 31.5 },
        { type: "review", share_pct: 27.8 },
        { type: "comparison", share_pct: 18.6 },
        { type: "directory", share_pct: 14.9 },
        { type: "guide", share_pct: 7.2 }
      ],
      model_breakdown: [
        { model: "ChatGPT", model_share_pct: 38.2, color_lightmode: "#111827", color_darkmode: "#F3F4F6",
          model_logo_url: quellzeichen("openai.com") },
        { model: "Perplexity", model_share_pct: 27.4, color_lightmode: "#20808d", color_darkmode: "#4fc3d0",
          model_logo_url: quellzeichen("perplexity.ai") },
        { model: "Google AI Overviews", model_share_pct: 21.9, color_lightmode: "#4285F4", color_darkmode: "#8AB4F8",
          model_logo_url: quellzeichen("google.com") },
        { model: "Claude", model_share_pct: 12.5, color_lightmode: "#d97757", color_darkmode: "#e6a58b",
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
  var FEN_TEAM_AKTIV = 0;          /* Kestrel -- das ausgewaehlte Team, bleibt oben stehen */
  var FEN_TEAM_FEST = 3;           /* Nimbus -- die dritte Zeile, sie traegt den Chip */
  /* Die MITTLERE Zeile wechselt. Vier Teams, dann faengt es wieder vorn an -- also vier Runden
     bis zum Anfang. Nicht die dritte Zeile: der Chip gehoert zu IHREM Team, und ein Chip, der
     alle fuenf Sekunden auf ein anderes Team springt, sagt nichts mehr aus. */
  var FEN_TEAM_WECHSEL = [1, 2, 4, 5];   /* Vantage, Halden, Lumen, Verity */
  var FEN_TEAM_MS = 5000;
  /* Der Wechsel selbst: die Zeile geht weg, wird ausgetauscht, kommt zurueck. Zwei Haelften einer
     Bewegung, deshalb zwei Zahlen; die CSS traegt den Uebergang (landing-hero.css). */
  var FEN_TEAM_AUS = 260, FEN_TEAM_AN = 300;

  function teamDomain(m){ return m.name.toLowerCase() + ".example"; }

  /* Eine Zeile des Panels. logo/name/domain wie in der Leiste, der Haken rechts kommt mit und ist
     nur in der aktiven Zeile zu sehen (core.css: .up-pop-opt.is-active .up-check). */
  function teamZeile(i, aktiv, chip){
    var m = MARKEN[i];
    return '<div class="up-pop-opt usn-teamrow' + (aktiv ? " is-active" : "") + '" data-team-row="' +
        (aktiv ? "aktiv" : (chip ? "fest" : "wechsel")) + '">' +
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
              teamZeile(FEN_TEAM_AKTIV, true, null) +
              teamZeile(FEN_TEAM_WECHSEL[0], false, null) +
              teamZeile(FEN_TEAM_FEST, false, "Pitch") +
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
    var k = 0;
    setInterval(function(){
      var zeile = root.querySelector('.ulh-fen-teams [data-team-row="wechsel"]');
      if (!zeile) return;
      k = (k + 1) % FEN_TEAM_WECHSEL.length;
      zeile.classList.add("is-tausch");
      setTimeout(function(){
        var neu = teamZeile(FEN_TEAM_WECHSEL[k], false, null);
        var huelle = document.createElement("div");
        huelle.innerHTML = neu;
        var frisch = huelle.firstChild;
        frisch.classList.add("is-tausch");
        if (zeile.parentNode) zeile.parentNode.replaceChild(frisch, zeile);
        /* Ein Bild warten, bevor die Klasse faellt: ohne das steht das neue Element von Anfang an
           im Endzustand und kommt ohne Bewegung. */
        setTimeout(function(){ frisch.classList.remove("is-tausch"); }, 30);
        zeichenSetzen(root);
      }, FEN_TEAM_AUS);
    }, FEN_TEAM_MS);
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
  var FEN_URL_STAND = [
    { zitate: 71400, rest: 14.0, typen: [
      { type: "article",       share_pct: 22.8 },
      { type: "guide",         share_pct: 16.4 },
      { type: "listicle",      share_pct: 12.1 },
      { type: "comparison",    share_pct: 10.7 },
      { type: "forum",         share_pct: 9.3 },
      { type: "review",        share_pct: 8.2 },
      { type: "documentation", share_pct: 6.5 }
    ]},
    /* FUENF benannte Typen und der Rest: sechs Punkte, also drei Reihen zu zwei. Die
       Beschriftungen dieser Verteilung sind laenger ("Product / Service" allein ist 114px), es
       gehen also nur zwei in eine Reihe -- mit sieben benannten waeren es vier Reihen gewesen,
       und die vierte trug nur noch zwei Punkte. Drei Reihen sind die Obergrenze in diesem
       Fenster, in beiden Verteilungen.
       Die Anteile der zwei gestrichenen Typen (Comparison, Review) sind auf die fuenf verbliebenen
       verteilt und nicht in den Rest gewandert: ein "Other" als zweitgroesste Scheibe waere die
       Aussage "wir wissen es meistens nicht". */
    { zitate: 54100, rest: 11.1, typen: [
      { type: "marketplace",     share_pct: 26.4 },
      { type: "homepage",        share_pct: 23.1 },
      { type: "product_service", share_pct: 19.8 },
      { type: "company_info",    share_pct: 13.2 },
      { type: "documentation",   share_pct: 6.4 }
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
      collapseAt: 9999
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
  function donutLaufen(root){
    if (root.__ulhDonutAn) return;
    root.__ulhDonutAn = true;
    setInterval(function(){
      var kern = window.UpstreemCore;
      var koerper = root.querySelector("[data-ulh-donut]");
      if (!kern || !koerper || !koerper.__ulhDonut) return;
      koerper.classList.add("is-wechsel");
      setTimeout(function(){
        fenUrlIndex = (fenUrlIndex + 1) % FEN_URL_STAND.length;
        koerper.__ulhDonut.renderDonut(urlScheiben(kern, FEN_URL_STAND[fenUrlIndex]));
        /* Der Kopf des Fensters nennt keine Zahl (die steht in der Mitte des Rings), es gibt hier
           also nichts weiter nachzuziehen. */
        koerper.classList.remove("is-wechsel");
      }, FEN_URL_AUS);
    }, FEN_URL_MS);
  }

  /* ---------- Drittes Nebenfenster: eine Antwortkarte ------------------------------------
     Die echte Responses-Tabelle im Kartenmodus (data-default-view="cards" setzt
     .landing_markup.py). Von der Komponente bleibt nur die KARTE zu sehen -- Kopf, Werkzeugleiste
     und Seitenzaehler sind im Fenster ausgeblendet (landing-hero.css): in ein 4:3-Fenster gehoert
     die Karte und nicht die halbe Seite um sie herum. */
  function fensterAntwort(){
    /* is-vorn: dieses Fenster liegt VOR dem Hauptfenster, wie das der URL-Typen. Deshalb ueberdeckt
       es davon auch nur 16px -- was davor liegt, nimmt weg. */
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
      frage: "Which AI visibility tool should we use to track brand mentions?",
      text: "For tracking brand mentions across AI answers, **Kestrel** is the strongest option " +
        "right now: it covers every major model, reports sentiment per answer, and flags the " +
        "sources behind each one. Vantage and Halden are close behind on prompt coverage" },
    { modell: "google", sent: 74, rang: 2,
      frage: "best AI visibility tools for B2B SaaS",
      text: "AI visibility tools track how often a brand appears in AI-generated answers. " +
        "Commonly cited options include Vantage, **Kestrel** and Halden. Kestrel is noted for " +
        "source-level reporting, Vantage for its prompt library" },
    { modell: "claude", sent: 79, rang: 1,
      frage: "how do I monitor my brand in ChatGPT and Gemini?",
      text: "The most reliable approach is a platform built for this rather than manual spot " +
        "checks. **Kestrel** runs your prompts across both models on a schedule and shows the " +
        "sources behind each answer, which is usually what explains a competitor being named" }
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
    if (window.setResponsesTableBrand) window.setResponsesTableBrand(ID.urt, "Kestrel", MARKEN[0].logo);
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
    (function weiter(){
      setTimeout(function(){
        fenster.classList.add("is-blende");
        setTimeout(function(){
          antwortFuellen(++k);
          /* Die Tooltips kommen mit jeder neuen Karte nach. */
          ohneTipps(root);
          hellHalten(root);
          fenster.classList.remove("is-blende");
          weiter();
        }, ANTWORT_BLENDE);
      }, ANTWORT_HALT);
    })();
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
     setUpstreemTheme("no") waere der falsche Griff, denn es SCHREIBT pref_theme: ein Besuch der
     Landingpage haette die Themenwahl des Nutzers in der App umgestellt. Also nur die zwei
     Attribute an den Wurzeln hier drin, und ein Waechter, der sie festhaelt, falls core sie spaeter
     noch einmal anfasst. Nur schreiben, wenn der Wert abweicht -- sonst loest der Waechter sich
     selbst wieder aus. */
  function hellHalten(root){
    var alle = [root].concat([].slice.call(root.querySelectorAll(".up-root")));
    alle.forEach(function(el){
      /* EIN Nebenfenster ist dunkel (die URL-Typen). Es traegt data-ulh-dunkel, und alles darin
         bekommt hier das dunkle Thema statt des hellen -- derselbe Waechter, nur mit dem anderen
         Wert. Ohne diese Abfrage haette der Waechter das Fenster im naechsten Takt wieder
         aufgehellt, und der Doughnut haette dunkle Farben auf hellem Grund gezeichnet. */
      var dunkel = el.closest && el.closest("[data-ulh-dunkel]");
      var thema = dunkel ? "dark" : "light", ist = dunkel ? "yes" : "no";
      if (el.getAttribute("data-theme") !== thema) el.setAttribute("data-theme", thema);
      if (el.getAttribute("data-isdark") !== ist) el.setAttribute("data-isdark", ist);
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
  }

  /* ---------- Daten hineingeben ----------------------------------------------------------- */

  function fuellen(){
    var serie = reihen("a");
    var tab = tabelle("a");
    /* Die eigene Marke ist Kestrel und steht im Zustand A auf Platz 3 -- nicht tab[0]. Der
       Seitenkopf zeigt IHRE Zahlen, nicht die des Ersten. */
    var eigene = tab.filter(function(r){ return r.company_id === "ke"; })[0] || tab[0];

    if (window.setSidebarTeams){
      /* Acht Teams. Nur das erste ist zu sehen (es ist das aktive) -- die anderen sieben zaehlen im
         Teams-Eintrag der Leiste mit, und genau der soll 8 zeigen. */
      window.setSidebarTeams(ID.usn, [
        { id: "t1", name: "Kestrel",  domain: "kestrel.example",  favicon_url: "" },
        { id: "t2", name: "Vantage",  domain: "vantage.example",  favicon_url: "" },
        { id: "t3", name: "Halden",   domain: "halden.example",   favicon_url: "" },
        { id: "t4", name: "Nimbus",   domain: "nimbus.example",   favicon_url: "" },
        { id: "t5", name: "Lumen",    domain: "lumen.example",    favicon_url: "" },
        { id: "t6", name: "Verity",   domain: "verity.example",   favicon_url: "" },
        { id: "t7", name: "Solace",   domain: "solace.example",   favicon_url: "" },
        { id: "t8", name: "Marlow",   domain: "marlow.example",   favicon_url: "" }
      ]);
      window.setSidebarUser(ID.usn, { name: "Alex Moreno", email: "alex@kestrel.example", avatar_url: "" });
      /* Vierzehn Marken im Store. Die Leiste zieht ihren Brands-Zaehler daraus, und er soll dieselbe
         Zahl nennen wie die Kopfzeile der Tabelle. Sichtbar sind nur die sechs oben; die acht
         weiteren stehen nur als Bestand da und tauchen nirgends auf. */
      if (window.setUpstreemBrands) window.setUpstreemBrands(
        MARKEN.map(function(m){ return { company_id: m.id, name: m.name }; }).concat(
          ["Solace", "Marlow", "Aster", "Bramble", "Cinder", "Dovetail", "Ember", "Fennel"]
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
        window.upstreemPinToSidebar({ type: "domain", id: "kestrel.example",
          label: "kestrel.example", logo: zeichen("K", "#9DC3A3") });
        window.upstreemPinToSidebar({ type: "brand", id: "ke",
          label: "Kestrel", logo: MARKEN[0].logo });
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
      visLinieFuellen(w);
      /* Die dritte Reihe: Band und Bahnen werden gebaut und danach in Bewegung gesetzt. */
      visSprachenFuellen(w);
      visModelleFuellen(w);
      ulhTakt(w);
      quellFuellen();
      auftritte(w);
      hellBewachen(w);
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
        brand: { id: "ke", name: "Kestrel", logo: MARKEN[0].logo },
        brandMentioned: ""
      });
    }
  }

  /* ---------- Der Filterwechsel ---------------------------------------------------------- */

  /* Drei Sekunden nachdem das Dashboard fertig steht, wechselt es EINMAL von Zustand A auf B -- wie
     ein Filterwechsel in der App: Kestrel steigt von Platz 3 auf 1, Lumen und Verity tauschen 5 und
     6, alle sechs Linien im Chart fahren auf ihre neuen Werte, und jede Zahl zaehlt dorthin.
     Einmal und nicht im Kreis: eine Sektion, die sich alle drei Sekunden umsortiert, liest sich als
     Fehler und nicht als Funktion. Eine Folge mehrerer Szenen ist Schritt 2 der Landingpage.

     Der Wechsel laeuft NICHT ueber renderVisibilityChart. Das waere der kurze Weg und der falsche:
     der Setter schreibt die Tabelle als innerHTML neu -- dann gibt es keine Zeilen mehr, die
     wandern koennten -- und build() im Kit ruft destroy(), dann spielt die Eingangsanimation des
     Charts von vorn. Also von Hand: Chart.js bekommt neue Zahlen in seine Datensaetze und
     interpoliert sie mit seinen eigenen 600ms, die Zeilen wandern per FLIP, die Zahlen zaehlen. */

  var SZENE_WARTEN = 3000;      /* nach dem fertigen Dashboard, nicht nach dem Skriptstart */
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
       keinen. Ohne Fuellung schlagen zwei Zeilen durcheinander, die sich kreuzen: Lumen und Verity
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
     der die Marke steht. Ein Zuordnen ueber die Position haette die Werte von Kestrel auf die Linie
     von Vantage geschrieben. */
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
         40, 60 und 75). Kestrel geht von 74 auf 79 und Vantage von 76 auf 75 -- beide ueberschreiten
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

    /* Die Kennzahlen im Seitenkopf gehoeren Kestrel und nicht dem Ersten der Tabelle. Reihenfolge
       im Markup: Visibility, Ranking, Sentiment (dashboard-page-header.js, setKpis).
       Von Hand und nicht ueber setDashboardPageHeaderKpis: der Setter schreibt die Zeile als
       innerHTML neu, und dann springen die drei Zahlen statt zu zaehlen. */
    var kea = alt["ke"], keb = neu["ke"];
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
       0            das Fenster erscheint in vier Stufen (CSS, ulhRise)
       1410         das Erscheinen ist durch -- 720ms Verzoegerung der letzten Stufe plus 690ms Lauf
       ~3200        der Filterwechsel im Dashboard (gegatet auf das fertige Chart)
       7410         das Dashboard blendet aus, halb so lang wie eine Erscheinensstufe
       7755         Mira kommt mit derselben Bewegung von unten herein
       +600         die Frage wird Zeichen fuer Zeichen getippt
       +2000        Mira denkt
       dann         die Antwort erscheint und tippt sich selbst
     Alles ueber Uhren und nicht ueber Scrollen: die Sektion steht am Seitenanfang und laeuft einmal
     durch. Ob spaeter der Scrollstand die Szenen treibt, ist Schritt 3 -- dann tauscht nur der
     Ausloeser, nicht der Ablauf. */
  var ERSCHEINEN_MS = 1410;      /* muss zur CSS passen: 720ms Verzoegerung + 690ms Lauf */
  /* Mira kommt als EINE Stufe herein, nicht als vier -- also nur der Lauf, ohne Verzoegerungen. */
  var MIRA_RISE_MS = 690;
  var AUSBLENDEN_MS = 345;       /* halb so lang wie eine Erscheinensstufe */
  /* Wie lange ein Schritt STEHT, nachdem seine Bewegung durch ist -- fuer alle drei gleich.
     Der Wert kommt vom Dashboard und ist nicht gewaehlt: dort endet das Erscheinen bei 1410, der
     Filterwechsel laeuft bei ~3200 an und ist bei ~4130 durch, und ausgeblendet wird bei 7410.
     Bleiben 3280ms Stillstand. Genau die bekommen Mira und die Prompts-Liste jetzt auch.
     MIRA_WARTEN bleibt die Uhr fuer das Dashboard -- sie zaehlt ab dem Erscheinen und muss die
     Bewegung darin mit abdecken. */
  var STAND_MS = 3280;
  var MIRA_WARTEN = 6000;        /* nach dem Ende des Erscheinens, Bewegung inbegriffen */
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
    return miraChip(id === "ke" ? "brand" : "competitor", m.id, m.name);
  }

  /* Die zwei Quellen, auf die die Empfehlungen zeigen -- dieselben zwei, die auch im Zitatteil des
     Dashboards oben stehen, mit ihrem echten Zeichen (siehe quellzeichen). Die AUSSAGEN darueber
     sind ueber die eigene Marke formuliert und nicht ueber die Seite: "deine Preisseite wird dort
     nicht zitiert" ist eine Aussage ueber Kestrel, "die Seite verschweigt dich" waere eine ueber
     Reddit. */
  var MIRA_QUELLEN = [
    /* Kurze Pfade mit Absicht: der Chip zeigt Domain UND Pfad, und ein langer Pfad schiebt den
       Listenpunkt auf zwei Zeilen -- 26px, die im Fenster fehlen. */
    { id: "u1", domain: "forbes.com", pfad: "/ai-tools",
      titel: "Best AI visibility tools, 2026 edition" },
    { id: "u2", domain: "reddit.com", pfad: "/pricing",
      titel: "Pricing comparison thread" }
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
      return { id: "ev-" + m.id, type: m.id === "ke" ? "brand" : "competitor",
               entity_id: m.id, company_id: m.id, company_name: m.name, title: m.name,
               icon_url: m.logo, action: m.id === "ke" ? "open_brand" : "open_competitor" };
    });
    MIRA_QUELLEN.forEach(function(q){
      aus.push({ id: "ev-" + q.id, type: "url", entity_id: q.id, title: q.titel,
                 url: "https://" + q.domain + q.pfad, entity_url: "https://" + q.domain + q.pfad,
                 domain: q.domain, icon_url: quellzeichen(q.domain),
                 action: "open_url" });
    });
    aus.push({ id: "ev-r1", type: "response", entity_id: "r1",
               title: "Which AI visibility tool should we use?", subtitle: "chatgpt",
               prompt_run_id: "r1", action: "open_response",
               icon_url: zeichen("C", "#10a37f") });
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
  var MIRA_ZEILEN = 4;

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
    var ke = tab.filter(function(r){ return r.company_id === "ke"; })[0];
    return '<h3>AI Visibility Report, Q3 2026</h3>' +
      '<table><thead><tr><th>Brand</th><th>Visibility</th><th>Rank</th><th>Sentiment</th>' +
      '<th>Mentions</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
      /* ZWEI Zeilen Deutung, nicht zwei Absaetze, und danach drei kurze Empfehlungen. Der Grund ist
         gemessen: die Antwort muss ohne Scrollen in das Fenster passen, und mit fuenf Zeilen Prosa
         plus vier zweizeiligen Punkten waren es 340px zu viel. Kuerzer ist hier auch besser: eine
         Antwort, die man im Vorbeigehen liest, hat drei Punkte und nicht sieben. */
      '<p>' + markeChip("ke") + ' closed the quarter first, ahead of ' + markeChip("va") + ' and ' +
      markeChip("ha") + ': visibility ' + ke.visibility_pct.toFixed(1) + '%, rank ' +
      ke.avg_rank.toFixed(1) + ', sentiment ' + ke.sentiment + '. Editorial sources carry ' +
      '<strong>31.4%</strong> of every citation, your own pages 9.3%.</p>' +
      '<h4>What to do next</h4><ul>' +
      '<li>' + quelleChip(0) + ' names ' + markeChip("va") + ' in every comparison answer, never you.</li>' +
      '<li>' + quelleChip(1) + ' puts ' + markeChip("ha") + ' above you on all five pricing prompts.</li>' +
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

  function miraSenden(root){
    var m = miraNachrichten();
    var ta = root.querySelector("#am-textarea");
    /* Der aktive Chat MUSS gesetzt sein, bevor die erste Nachricht kommt. Ohne ihn faellt Mira nach
       140ms auf den Startbildschirm zurueck (_maybeHomeIfUnknownChat) -- eine abgeschickte Frage,
       die kurz aufblitzt und dann verschwindet. Gemessen, als der Aufruf noch fehlte. */
    /* Der Titel oben links kommt NICHT aus einem eigenen Setter: Mira sucht den aktiven Chat in der
       Liste der frueheren Chats und nimmt dessen title (renderChatTitlebar in ask-mira.js). Ohne
       diese Liste blieb dort das Ladeskelett stehen. titlePending muss dazu aus, sonst zeigt die
       Zeile weiter den Lader -- auch mit vorhandenem Titel. */
    if (window.askMiraSetPreviousChats) window.askMiraSetPreviousChats([
      { id: "lh-chat", title: "AI Visibility Report Q3 2026", updated_at: new Date().toISOString() }
    ]);
    if (window.askMiraSetTitlePending) window.askMiraSetTitlePending("no");
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
      hellHalten(root);
      ohneTipps(root);
      miraZeilenAnsetzen(root);
    }, MIRA_DENKT_MS);
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

  /* Sobald die Seite bewegt wird, geht das Fenster auf 80 Prozent zurueck; oben angekommen wird es
     wieder gross.

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
  /* Ein Fuenftel kleiner. Der Wert stand schon einmal hier, wurde dann auf 0.9 halbiert -- damals
     war die Verkleinerung reine Bewegung, es gab nichts, was sie freilegen sollte. Jetzt gibt es
     das: drei Nebenfenster stehen links und rechts neben dem Hauptfenster, und ihr Platz entsteht
     ERST durch die Verkleinerung. Gerechnet fuer eine 1440px breite Sektion: bei 0.9 bleiben je
     Seite 72px, das Fenster der URL-Typen (372px breit) waere zu 84 Prozent abgeschnitten; bei 0.8
     sind es 144px, und mit der Ueberdeckung sind rund zwei Drittel jedes Nebenfensters zu sehen.
     Auf einer breiteren Sektion entsprechend mehr.
     Jetzt 0.76, also noch fuenf Prozent staerker: das Team-Fenster und die Antwortkarte stehen
     seit dieser Runde DIREKT neben dem Hauptfenster (4px Luft, keine Ueberdeckung mehr), und
     dieser Platz muss von der Verkleinerung kommen. */
  /* Der grosse Zustand ist wieder scale(1): das Hauptfenster ist jetzt SELBST schmaler, ueber
     --ulh-rand in der Spur (landing-hero.css) -- und mit ihm die beiden Schienen und der Inhalt
     jeder Sektion. Das war der Fehler im ersten Versuch: dort schrumpfte nur das Fenster ueber ein
     transform, die Schienen blieben stehen, und dazwischen klaffte je Seite der Rand.

     Der KLEINE Zustand soll dabei genau so gross bleiben wie vorher. Vorher war er 0.76 der ALTEN
     Spur; die Spur ist jetzt um beide Raender schmaler, also braucht es denselben absoluten Wert auf
     der neuen Breite. Gerechnet und nicht als Zahl hingeschrieben: der Rand steht in der CSS, und
     eine zweite Wahrheit hier waere beim naechsten Wert daneben. */
  var KLEIN_ALT = 0.76;
  function kleinFaktor(root){
    var b = root.querySelector(".ulh-buehne");
    var w = b ? b.offsetWidth : 0;                        /* offsetWidth: die LAYOUTbreite, ohne eine eigene Verkleinerung */
    if (!w) return KLEIN_ALT;
    var rand = parseFloat(getComputedStyle(root).getPropertyValue("--ulh-rand")) || 0;
    var f = KLEIN_ALT * (w + 2 * rand) / w;
    return Math.min(1, f);                                /* nie hochskalieren */
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
         900 ist dieselbe Schwelle wie in der CSS; sie steht hier als Zahl, weil ein Stylesheet
         seine Medienabfragen nicht herausgibt. */
      var schmal = (window.innerWidth || document.documentElement.clientWidth || 0) <= 900;
      var wunsch = (soll && !schmal) ? "scale(" + kleinFaktor(root).toFixed(4) + ")" : "scale(1)";
      /* Nur schreiben, wenn sich etwas aendert -- sonst waere das ein Stilschreiben je Takt, und
         jedes davon macht das Layout schmutzig. */
      if (rahmen.style.transform !== wunsch) rahmen.style.transform = wunsch;
      if (soll !== root.classList.contains("is-klein")){
        if (soll) root.classList.add("is-klein"); else root.classList.remove("is-klein");
      }
    }

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
        eltern_scroll: eltern
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
    { id: "t1", name: "Pricing",         emoji: "💸", hex_light: "#b3541e", hex_dark: "#e0a06a" },
    { id: "t2", name: "Comparisons",     emoji: "⚖️", hex_light: "#1f6feb", hex_dark: "#7aa9f0" },
    { id: "t3", name: "AI Search Tools", emoji: "🔎", hex_light: "#1a7f5a", hex_dark: "#6fc7a4" },
    { id: "t4", name: "Integrations",    emoji: "🔌", hex_light: "#8957e5", hex_dark: "#b79af0" },
    { id: "t5", name: "Enterprise",      emoji: "🏢", hex_light: "#0e7490", hex_dark: "#6bb6c9" },
    { id: "t6", name: "Reporting",       emoji: "📊", hex_light: "#be185d", hex_dark: "#e78bb0" },
    { id: "t7", name: "Getting Started", emoji: "🚀", hex_light: "#6f737c", hex_dark: "#a8adb6" },
    /* Das achte Thema gibt es, seit die Matrix acht Zeilen zeigt. Es steht auch den anderen
       Vorschauen zur Verfuegung -- die nehmen sich ihre Themen vom Anfang der Liste. */
    { id: "t8", name: "Migration",      emoji: "🧳", hex_light: "#a16207", hex_dark: "#d9b45f" }
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
    { key: "Evaluation",     tag_ids: ["t3", "t4"], hex: "#9DC3A3", anzahl: 64 },
    { key: "Enterprise fit", tag_ids: ["t5", "t6"], hex: "#9FBFC2", anzahl: 75 },
    { key: "Onboarding",     tag_ids: ["t7"],       hex: "#E0B384", anzahl: 29 }
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
    ["Which AI visibility tool should we use in 2026?", ["t3", "t2"], 41.2, 1.2, 81, 6, "US"],
    ["Best tools to track how often my brand appears in ChatGPT and Perplexity answers", ["t3"], 38.4, 1.4, 79, 5, "US"],
    ["How much does AI search monitoring cost per month for a team of ten?", ["t1"], 34.9, 1.8, 76, 4, "DE"],
    ["upstreem vs the alternatives for AI search analytics", ["t2", "t3"], 33.1, 2.0, 78, 6, "US"],
    ["Is there a free tier for tracking brand mentions in LLM answers?", ["t1"], 29.6, 2.4, 71, 3, "US"],
    ["Which AI visibility platform integrates with Looker and BigQuery?", ["t4", "t2"], 28.2, 2.5, 74, 5, "US"],
    ["Does it work with our existing SEO stack?", ["t4"], 26.8, 2.7, 72, 4, "US"],
    ["Cheapest way to monitor competitor mentions across AI assistants", ["t1", "t2"], 25.4, 2.9, 69, 6, "US"],
    ["Can I export AI search visibility data to a spreadsheet every week?", ["t6", "t4"], 24.1, 3.0, 73, 3, "DE"],
    ["What does an AI visibility report for a quarter look like?", ["t6"], 22.9, 3.2, 75, 4, "DE"],
    ["Enterprise pricing for AI search monitoring with SSO and audit logs", ["t5", "t1"], 21.7, 3.3, 70, 5, "US"],
    ["Which vendor is SOC 2 compliant for AI search analytics?", ["t5"], 20.4, 3.5, 68, 4, "US"],
    ["How do I set up my first brand and competitor list?", ["t7"], 19.8, 3.6, 77, 2, "US"],
    ["Getting started with prompt tracking, step by step", ["t7", "t3"], 18.6, 3.8, 76, 3, "US"],
    ["Do AI answer engines cite our documentation or our competitors?", ["t2", "t6"], 17.9, 4.0, 66, 6, "US"],
    ["Best AI search analytics for agencies managing several clients", ["t5", "t2"], 16.8, 4.1, 69, 5, "US"],
    ["Can we pull the data into our own warehouse via API?", ["t4", "t5"], 15.9, 4.3, 71, 3, "US"],
    ["Which tool shows share of voice inside AI answers over time?", ["t6", "t3"], 15.1, 4.4, 72, 4, "US"],
    ["How long does it take to see results after adding new prompts?", ["t7"], 14.2, 4.6, 70, 2, "DE"],
    ["What is the difference between visibility and share of voice?", ["t6"], 13.4, 4.8, 74, 3, "US"],
    ["Monitoring brand sentiment in AI generated answers", ["t6", "t3"], 12.6, 5.0, 67, 5, "US"],
    ["Annual contract discount for AI visibility monitoring", ["t1", "t5"], 11.8, 5.1, 65, 4, "US"],
    ["Which competitors show up most often for our category prompts?", ["t2"], 11.1, 5.3, 68, 6, "US"],
    ["Does the platform track Gemini and Copilot as well?", ["t3", "t4"], 10.4, 5.5, 70, 4, "DE"],
    ["Onboarding checklist for a new workspace", ["t7", "t5"], 9.6, 5.7, 72, 2, "US"],
    ["How do I invite my whole team and set roles?", ["t7", "t5"], 8.9, 5.9, 71, 3, "US"]
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
  var PROMPTS_WARTEN = 2200;

  function promptsAnsetzen(root){
    if (root.__ulhPromptsAn) return;
    root.__ulhPromptsAn = true;
    var n = 0, hatGetippt = false;
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
      /* Rueckhalt: faengt das Tippen nie an (eine Antwort ohne Text, ein Fehler im Kit), soll der
         Ablauf trotzdem weitergehen -- nach 30 Sekunden mit zwei Nachrichten reicht es.
         Und zwei Minuten Geduld insgesamt: in einem verdeckten Tab sind alle Uhren auf eine
         Sekunde gedrosselt, dort braucht die Mira-Szene ein Vielfaches ihrer Zeit. */
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

     Die Domains sind ECHT, wo die Quelle fremd ist (g2.com, reddit.com, youtube.com), und
     erfunden, wo sie der eigenen Marke gehoert (kestrel.example) -- dieselbe Aufteilung wie im
     Zitatteil des Dashboards, Begruendung dort. Die Ueberschriften sind dabei als AUFGABE oder
     als Aussage ueber die eigene Marke formuliert und nicht als Aussage ueber die fremde Seite:
     "hol dir den Eintrag dort" statt "die Seite verschweigt dich". */
  var CHANCEN = [
    ["o1", "pending", "get_listed", "Get listed on the g2.com category page for AI visibility",
     "Vantage and Halden hold entries there. You do not.",
     "High", "Best AI visibility tools, 2026 edition", "g2.com", "Editorial", "US", 4, 88.4],
    ["o2", "pending", "create_matching_content", "No page of yours answers \u201ehow much does AI search monitoring cost\u201c",
     "214 runs a month, and never one of your pages.",
     "Medium", "Pricing comparison thread", "reddit.com", "UGC_Community", "US", 3, 61.2],
    ["o3", "pending", "improve_existing_content", "Your integrations page is cited but never quoted",
     "Models reach the page and quote a competitor.",
     "Low", "Integrations overview", "kestrel.example", "Brand_Platform", "DE", 2, 34.5],
    ["o4", "in_progress", "build_presence", "Show up in the two comparison videos that decide this category",
     "Both rank top three, and both of them name Halden.",
     "High", "Which tool do you use in 2026?", "youtube.com", "UGC_Community", "US", 5, 79.1]
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
           eigenen -- fuer kestrel.example gibt es kein echtes, die Marke ist erfunden. */
        lead_favicon: c[7].indexOf("kestrel.example") >= 0 ? MARKEN[0].logo : quellzeichen(c[7]),
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
  var CHANCEN_ZUG = 800;
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
      r.el.style.transform = "translate(" + r.dx + "px," + r.dy + "px)";
    });
    void reihe[0].el.offsetHeight;
    requestAnimationFrame(function(){
      reihe.forEach(function(r){
        r.el.style.transition = "transform " + CHANCEN_ZUG + "ms " + WEICH;
        r.el.style.transform = "translate(0,0)";
      });
    });
    setTimeout(function(){
      reihe.forEach(function(r){
        r.el.style.transition = ""; r.el.style.transform = "";
        r.el.style.position = ""; r.el.style.zIndex = "";
      });
    }, CHANCEN_ZUG + 120);
  }

  function karte(root, id){ return root.querySelector('.uo-card[data-id="' + id + '"]'); }

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
  var CHANCEN_ZWEIT = 700;      /* Ruhe zwischen den zwei Zuegen */
  var CHANCEN_HALT = 2000;      /* Endzustand des Bretts, bevor die Karte aufgeht */
  var CHANCEN_OFFEN = 4000;     /* wie lange die Schublade offen bleibt */
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
    setTimeout(function(){ chancenSzene(root); }, AUSBLENDEN_MS + zeilenEnde + STAND_MS);
  }

  /* ---------- Fuenfte Szene: Performance -----------------------------------------------------
     Die Heatmap Thema x Marke, dieselbe Komponente wie in der App (performance-radar.js).
     Die Zahlen entstehen aus den Marken- und Themendaten, die die Sektion ohnehin zeigt: die
     Sichtbarkeit einer Marke ist ihr Wert aus dem Dashboard, je Thema um einen festen Faktor
     verschoben. So passen die Zahlen hier zu den Zahlen zwei Szenen vorher -- eine Marke, die im
     Chart vorn liegt, liegt es auch in der Matrix. */
  var PERF_THEMEN = 8, PERF_MARKEN = 5;
  /* Ein Faktor je Thema und Marke. Er macht aus fuenf gleichen Zeilen ein Bild mit Staerken und
     Luecken -- und genau das ist der Zweck der Matrix. Kestrel (erste Spalte) ist bei Pricing und
     AI Search Tools stark und bei Enterprise schwach; das ist die Geschichte, die die Sektion
     auch sonst erzaehlt. */
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
  var PERF_STAND_MS  = 4000;  /* so lange steht jede der zwei Ansichten -- NACH ihrem Auftritt */
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

  /* Zweite Ansicht: Stimmung mit den Balken, die zeigen, auf wie vielen Erwaehnungen ein Wert
     beruht. Der Umschalter in der Karte stellt sich dabei selbst um -- setMetric zieht ihn nach
     (syncSeg), und der Streifen aus core gleitet hinueber. */
  function perfZweiteAnsicht(root){
    var karte = perfHinaus(root);
    perfNach(function(){
      perfAnsicht(root, "sentiment", true);
      if (karte) karte.classList.remove("is-geht");
      perfWennGezeichnet(root, function(){
        perfNach(function(){ perfSchluss(root); }, PERF_AUF_MS + PERF_STAND_MS);
      });
    }, PERF_ABGANG_MS);
    return true;
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
        perfWennGezeichnet(root, function(){
          perfNach(function(){ perfZweiteAnsicht(root); }, PERF_AUF_MS + PERF_STAND_MS);
        });
      }, PERF_SEITE_MS);
    }, AUSBLENDEN_MS);
    return true;
  }

  function chancenSzene(root){
    var prompts = root.querySelector(".ulh-prompts");
    var seite = root.querySelector(".ulh-chancen");
    if (!prompts || !seite || seite.__ulhChancenAuf) return false;
    seite.__ulhChancenAuf = true;
    prompts.classList.remove("is-da");
    prompts.classList.add("is-weg");
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
  var NEUSTART_KOMMT = 1000;     /* so lange traegt die Dashboard-Seite is-kommt (drei Stufen, 300 + 520) */

  function neustart(root){
    var main = root.querySelector(".ulh-main");
    var mira = root.querySelector(".ulh-mira");
    var prompts = root.querySelector(".ulh-prompts");
    var chancen = root.querySelector(".ulh-chancen");
    var perf = root.querySelector(".ulh-perf");
    if (!main || !chancen) return false;

    /* 1. Die letzte Seite geht -- wie jeder andere Wechsel. Das ist jetzt die Performance-Seite;
       das Brett davor ist zu diesem Zeitpunkt schon weg. */
    if (perf){ perf.classList.remove("is-da"); perf.classList.add("is-weg"); }
    chancen.classList.remove("is-da");
    chancen.classList.add("is-weg");
    if (window.setSidebarActive) window.setSidebarActive(ID.usn, "dashboard");

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
      [mira, prompts, chancen, perf].forEach(function(seite){
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

      /* 5. Die Seite kommt zurueck, gestaffelt wie jede andere. */
      main.classList.remove("is-weg");
      main.classList.add("is-da");
      main.classList.add("is-kommt");
      setTimeout(function(){ main.classList.remove("is-kommt"); }, NEUSTART_KOMMT);

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
    root.__ulhNeu     = function(){ return neustart(root); };
    var n = 0;
    (function warte(){
      if (bereit()){
        try { fuellen(); } catch (e){ if (window.console) console.warn("[landing-hero]", e); }
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
        szeneAnsetzen(root);
        miraAnsetzen(root);
        return;
      }
      if (++n > VERSUCHE){
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
    window.addEventListener("resize", function(){ mass(root); });
  }

  /* Das Erscheinen anstossen. is-shown BLEIBT und macht das Fenster ueberhaupt sichtbar,
     is-entering traegt die vier gestaffelten Animationen und faellt danach ab -- bliebe sie stehen,
     liefe jede spaetere Bewegung im Fenster gegen eine noch gesetzte animation.
     Die Abfallzeit MUSS hinter dem Ende der letzten Stufe liegen: 720ms Verzoegerung plus 690ms
     Lauf sind 1410 (siehe landing-hero.css), also 1600 mit Reserve fuer einen Frame Verzug beim
     Klassenwechsel. Hier stand 1100 -- der Wert aus der Zeit, als eine Stufe 460ms lief. Nach der
     Verlaengerung schnitt er die letzte Stufe 310ms vor ihrem Ende ab, und der Zitatblock sprang
     dabei auf seinen Endzustand. Gemessen: is-entering fiel bei 1102ms ab. */
  function erscheinen(root){
    if (root.__ulhErschienen) return;
    root.__ulhErschienen = true;
    root.classList.add("is-shown");
    root.classList.add("is-entering");
    setTimeout(function(){ root.classList.remove("is-entering"); }, ERSCHEINEN_MS + 190);
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
      los(roots[i]);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
