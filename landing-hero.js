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
  var ID = { usn: "lh-usn", dph: "lh-dph", vot: "lh-vot", tcd: "lh-tcd" };

  /* ---- MARKUP ANFANG (erzeugt von .landing_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    usn: "<div class=\"up-root usn-root\" data-instance=\"lh-usn\" data-cdn-pin=\"\" data-isdark=\"no\" data-team-id=\"t1\" data-active=\"dashboard\" data-prompt-count=\"\" data-export-instance=\"\"></div>",
    dph: "<div class=\"up-root up-ph-root dph-root\" data-instance=\"lh-dph\" data-cdn-pin=\"\" data-isdark=\"no\" data-brand-name=\"Kestrel\" data-brand-logo=\"\"><div class=\"up-ph-top\"><div class=\"up-ph-left\"><div class=\"up-ph-meta\"><img class=\"up-ph-metalogo\" alt=\"\" style=\"display:none\"/><span class=\"up-ph-metatxt\"><span class=\"pph-metaname\"></span></span></div><h1 class=\"up-ph-heading\">Dashboard</h1><p class=\"up-ph-desc\">Monitor your AI visibility, performance, and latest developments</p></div><div class=\"dph-topright\"><!-- dashboard-page-header.js fills this in on setDashboardPageHeaderKpis(). --><div class=\"dph-kpis\"></div><div class=\"dph-tools\"><button class=\"dph-docsbtn\" type=\"button\" data-tip=\"Open Documentation\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 5v16\" /><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\" /></svg><span>Docs</span></button><button class=\"dph-refreshbtn up-ph-iconbtn\" type=\"button\" aria-label=\"Refresh\" data-tip=\"Refresh Data\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /><path d=\"M21 3v5h-5\" /><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /><path d=\"M8 16H3v5\" /></svg></button></div></div></div></div>",
    vot: "<div class=\"up-root vot-root\" data-instance=\"lh-vot\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"vot-unit vot-unit-left\"><div class=\"vot-head\"><div class=\"vot-heading\">Visibility over Time</div><div class=\"vot-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\">Day</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\">Week</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\">Month</button></div><button class=\"vot-maximize vot-max-top vot-iconbtn\" type=\"button\" data-tip=\"Minimize\" aria-label=\"Minimize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"vot-box vot-box-left\"><div class=\"vot-panel-body\"><button class=\"vot-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"vot-unit vot-unit-right\"><div class=\"vot-head\"><div class=\"vot-heading vot-heading-right\"><span class=\"vot-head-label\">Top Brands</span><span class=\"vot-head-sep\"></span><span class=\"vot-head-count\"></span></div><div class=\"vot-head-tools\"><div class=\"vot-sort\"><button class=\"vot-sort-btn vot-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"vot-filter\"><button class=\"vot-filter-btn vot-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg><span class=\"vot-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"vot-export vot-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"vot-maximize vot-max-right vot-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button><button class=\"vot-goto vot-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" /></svg></button></div></div><div class=\"vot-box vot-box-right\"><div class=\"vt-table\"></div></div></div></div>",
    tcd: "<div class=\"up-root tcd-root\" data-instance=\"lh-tcd\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" /></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><rect x=\"7\" y=\"13\" width=\"9\" height=\"4\" rx=\"1\"/><rect x=\"7\" y=\"5\" width=\"12\" height=\"4\" rx=\"1\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-sep\"></span><span class=\"tcd-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" /></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    mqa: "<div id=\"mira-quick-actions\" data-theme=\"light\" data-team=\"\" data-cdn-pin=\"\" data-export-instance=\"\"><button class=\"mqa-trigger\" type=\"button\" aria-label=\"Open quick actions\"><svg class=\"mqa-trigger-ic\" viewBox=\"0 0 24 24\"><path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></svg><span class=\"mqa-trigger-label\">Quick Actions</span><span class=\"mqa-kbd\" data-kbd>\u2318K</span></button><div class=\"mqa-overlay\" role=\"presentation\" aria-hidden=\"true\"><div class=\"mqa-modal\" role=\"dialog\" aria-modal=\"true\" aria-label=\"Quick actions\"><div class=\"mqa-search\"><svg class=\"mqa-search-ic\" viewBox=\"0 0 24 24\"><path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></svg><span class=\"mqa-chips\" id=\"mqa-chips\"></span><span class=\"mqa-inputwrap\"><input class=\"mqa-input\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"\" aria-label=\"Search\" /><span class=\"mqa-ph\" id=\"mqa-ph\" aria-hidden=\"true\">Search brands, domains, URLs, prompts\u2026</span></span><span class=\"mqa-ph-cmd\" id=\"mqa-ph-cmd\" aria-hidden=\"true\">/ for filters</span><span class=\"mqa-kbd mqa-esc\" id=\"mqa-esc\">esc</span><button class=\"mqa-fav is-hidden\" type=\"button\" id=\"mqa-fav\" aria-pressed=\"false\" aria-label=\"Save as Favorite\"><svg viewBox=\"0 0 24 24\"><path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" /></svg></button><button class=\"mqa-clear is-hidden\" type=\"button\" id=\"mqa-clear\" aria-label=\"Reset search\"><svg viewBox=\"0 0 24 24\"><path d=\"M10 11v6\" /><path d=\"M14 11v6\" /><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" /><path d=\"M3 6h18\" /><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" /></svg></button></div><button class=\"mqa-entercta is-hidden\" type=\"button\" id=\"mqa-entercta\"> Press <span class=\"mqa-kbd\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 4v7a4 4 0 0 1-4 4H4\" /><path d=\"m9 10-5 5 5 5\" /></svg>Enter</span> to search </button><div class=\"mqa-scroll\"><div class=\"mqa-results\" aria-live=\"polite\"></div></div><div class=\"mqa-recent-wrap\" id=\"mqa-recent\"></div><div class=\"mqa-actions-wrap\"></div></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  /* ---------- Demodaten ----------------------------------------------------------------- */

  /* Hoechstens sieben Zeichen je Name. Gemessen: bei 1066px Inhaltsbreite -- und die ist fest,
     weil die Buehne fest ist -- kuerzt die Top-Brands-Tabelle "Northwind" auf "Northwi...".
     Kuerzere Namen sind der billigere Hebel als eine breitere Buehne, denn die Buehnenbreite
     steuert auch die Schriftgroesse im Fenster. */
  /* Jede Marke hat ZWEI Zustaende. A ist der Anfang, B der Stand nach dem Filterwechsel drei
     Sekunden spaeter. Die eigene Marke (Kestrel) startet auf Platz 3 und geht auf 1 -- aufwaerts,
     nicht abwaerts, das war die Ansage. Platz 5 und 6 tauschen (Lumen und Verity).
     Die VORZEICHEN der Trendwerte sind in A und B gleich. Das ist Absicht: so muss beim Wechsel nur
     die Zahl zaehlen, und Farbe und Pfeilrichtung des Trendzeichens bleiben, wie sie sind -- ein
     Umschlagen mitten in der Bewegung waere ein Sprung, den kein Zaehlen glaettet. Verity war der
     Fall, der das erzwungen hat: es steigt von Platz 6 auf 5, also steht auch im Zustand A schon
     ein kleines Plus davor und nicht das Minus, das dort zuerst stand. */
  var MARKEN = [
    { id: "ke", name: "Kestrel", farbe: "#1f6feb",
      a: { vis: 24.6, rank: 2.4, sent: 74, visD: 2.1, rankD: -0.3, sentD: 1.4 },
      b: { vis: 38.9, rank: 1.1, sent: 79, visD: 5.8, rankD: -1.3, sentD: 3.1 } },
    { id: "va", name: "Vantage", farbe: "#8957e5",
      a: { vis: 34.8, rank: 1.3, sent: 76, visD: 1.4, rankD: -0.1, sentD: 0.6 },
      b: { vis: 32.1, rank: 1.9, sent: 75, visD: 0.7, rankD: -0.4, sentD: 0.2 } },
    { id: "ha", name: "Halden",  farbe: "#1a7f5a",
      a: { vis: 30.2, rank: 2.1, sent: 71, visD: 1.9, rankD: -0.2, sentD: 2.1 },
      b: { vis: 27.4, rank: 2.6, sent: 70, visD: 1.1, rankD: -0.5, sentD: 1.4 } },
    { id: "ni", name: "Nimbus",  farbe: "#0e7490",
      a: { vis: 19.4, rank: 3.4, sent: 68, visD: -1.1, rankD: 0.4, sentD: -1.6 },
      b: { vis: 18.2, rank: 3.7, sent: 67, visD: -0.6, rankD: 0.2, sentD: -0.8 } },
    { id: "lu", name: "Lumen",   farbe: "#b3541e",
      a: { vis: 14.1, rank: 4.2, sent: 66, visD: -0.8, rankD: 0.3, sentD: 0.9 },
      b: { vis: 11.3, rank: 5.1, sent: 63, visD: -1.9, rankD: 0.7, sentD: 0.4 } },
    { id: "ve", name: "Verity",  farbe: "#be185d",
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
     Liste, ein unbekannter Name laeuft in den Rueckfall. Es sind genau sieben, und die sieben
     Quellen benutzen jeden einmal.
     Die Domains bleiben erfunden (*.example): die Anteile sind Demozahlen, und unter einem echten
     Namen saehen sie aus wie eine Aussage ueber diese Seite. Das Zeichen davor entsteht wie das der
     Marken, in einem neutralen Grau. */
  var QUELLEN = [
    { domain: "industryguide.example", share_pct: 18.4, share_delta_pct: 2.1,  used_total: 2926, citation_type: "Editorial" },
    { domain: "community.example",     share_pct: 14.1, share_delta_pct: -1.3, used_total: 2242, citation_type: "UGC_Community" },
    { domain: "wiki.example",          share_pct: 11.7, share_delta_pct: 0.8,  used_total: 1860, citation_type: "Knowledge_Base" },
    { domain: "kestrel.example",       share_pct: 9.3,  share_delta_pct: 3.4,  used_total: 1479, citation_type: "You" },
    { domain: "vantage.example",       share_pct: 7.6,  share_delta_pct: -0.4, used_total: 1208, citation_type: "Competition" },
    { domain: "docs.kestrel.example",  share_pct: 6.2,  share_delta_pct: 1.9,  used_total: 986,  citation_type: "Brand_Platform" },
    { domain: "university.example",    share_pct: 4.8,  share_delta_pct: -0.7, used_total: 763,  citation_type: "Institutional" }
  ];

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

  function bauen(root){
    if (root.querySelector(".ulh-frame")) return;          /* schon gebaut */
    root.innerHTML =
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
      '<div class="ulh-stage">' +
        '<div class="ulh-frame">' +
          '<div class="ulh-chrome" aria-hidden="true">' +
            '<span class="ulh-dot"></span><span class="ulh-dot"></span><span class="ulh-dot"></span>' +
          '</div>' +
          '<div class="ulh-view">' +
            '<div class="ulh-app">' +
              /* Quick Actions ist ein Seiten-Singleton und steht deshalb neben der Leiste, nicht
                 darin. sidebar.js haengt es von selbst in seine eigene Zeile um -- genau so
                 laeuft es in der App auch. */
              (MARKUP.mqa || "") +
              '<div class="ulh-side">' + (MARKUP.usn || "") + '</div>' +
              '<div class="ulh-main">' +
                (MARKUP.dph || "") + (MARKUP.vot || "") + (MARKUP.tcd || "") +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
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
    var view = root.querySelector(".ulh-view");
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
    var alle = root.querySelectorAll(".ulh-driver[data-ic]");
    for (var i = 0; i < alle.length; i++){
      var el = alle[i];
      var svg = kern.icon(el.getAttribute("data-ic"), 1.9);
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
    var view = root.querySelector(".ulh-view");
    if (!view) return;
    ["data-tip", "data-tiplabel"].forEach(function(attr){
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
      if (el.getAttribute("data-theme") !== "light") el.setAttribute("data-theme", "light");
      if (el.getAttribute("data-isdark") !== "no") el.setAttribute("data-isdark", "no");
    });
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
          return { domain: q.domain, favicon: zeichen(q.domain.charAt(0).toUpperCase(), "#6f737c"),
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
  /* 930ms fuer alles, was sich beim Wechsel bewegt: Zeilen, Linien, Tooltipzeilen, Zahlen. Vorher
     620 -- das war zu knapp, um als Bewegung gelesen zu werden. */
  var SZENE_DAUER = 930;
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
         Zaehlen. Also springt sie, und zwar auf der halben Strecke: vorher stimmte sie zur alten
         Lage der Zeile, nachher zur neuen. t und nicht e -- die Kurve ist zur halben Zeit bei 75
         Prozent, die Ziffer waere zu frueh gesprungen. */
      var idx = z.querySelector(".vt-td-idx");
      if (idx) werk.frei(function(e, t){
        var soll = String((t >= 0.5 ? b : a).position);
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
    chartWandern(root, reihen("b"), SZENE_DAUER);
    reihenWandern(root, ordnung, SZENE_DAUER);
    tippNachziehen(tipp, werk, SZENE_DAUER);
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
    bauen(root);
    nurSchauen(root);
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
          if (leisteHolen(root)){ mass(root); return; }
          if (k < 40) setTimeout(function(){ holen(k + 1); }, 100);
        })(0);
        /* Nach dem Fuellen noch einmal messen: die Tabellen bringen ihre Hoehe erst mit den
           Daten, und die Buehne muss den Ausschnitt danach immer noch fuellen. */
        mass(root);
        erscheinen(root);
        szeneAnsetzen(root);
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
     1100ms als Abfallzeit: die letzte Stufe startet bei 480ms und laeuft 460ms (siehe
     landing-hero.css), das sind 940 -- mit Reserve fuer einen Frame Verzug beim Klassenwechsel. */
  function erscheinen(root){
    if (root.__ulhErschienen) return;
    root.__ulhErschienen = true;
    root.classList.add("is-shown");
    root.classList.add("is-entering");
    setTimeout(function(){ root.classList.remove("is-entering"); }, 1100);
  }

  /* Die Szene startet erst, wenn das Dashboard WIRKLICH steht: Chart.js kommt vom CDN, und drei
     Sekunden reichen dafuer nicht immer. Waere sie vorher gelaufen, haetten sich die Zeilen
     umsortiert und die Linien nicht -- derselbe Widerspruch wie eine steigende Linie neben einem
     fallenden Pfeil, nur groesser. Zwei Bedingungen, weil beide Teile mitmuessen: eine lebende
     Chart-Instanz und die volle Zahl an Zeilen in der Tabelle. */
  function szeneAnsetzen(root){
    if (root.__ulhSzeneAn) return;
    root.__ulhSzeneAn = true;
    /* Als Handhabe nach draussen, nicht als Debug-Ausgabe: die Szenenfolge (Schritt 2 der
       Landingpage) soll den Wechsel selbst ausloesen koennen, statt auf die Uhr zu warten -- und
       genau darueber laesst er sich auch messen, ohne drei Sekunden zu warten. */
    root.__ulhSzene = function(){ return szene(root); };
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
