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
    tcd: "<div class=\"up-root tcd-root\" data-instance=\"lh-tcd\" data-cdn-pin=\"\" data-isdark=\"no\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /><path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" /></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><rect x=\"7\" y=\"13\" width=\"9\" height=\"4\" rx=\"1\"/><rect x=\"7\" y=\"5\" width=\"12\" height=\"4\" rx=\"1\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-sep\"></span><span class=\"tcd-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 12h14\" /></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 17H5\"/><path d=\"M19 7h-9\"/><circle cx=\"17\" cy=\"17\" r=\"3\"/><circle cx=\"7\" cy=\"7\" r=\"3\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 7h10v10\" /><path d=\"M7 17 17 7\" /></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  /* ---------- Demodaten ----------------------------------------------------------------- */

  /* Hoechstens sieben Zeichen je Name. Gemessen: bei 1066px Inhaltsbreite -- und die ist fest,
     weil die Buehne fest ist -- kuerzt die Top-Brands-Tabelle "Northwind" auf "Northwi...".
     Kuerzere Namen sind der billigere Hebel als eine breitere Buehne, denn die Buehnenbreite
     steuert auch die Schriftgroesse im Fenster. */
  var MARKEN = [
    { id: "ke", name: "Kestrel", farbe: "#1f6feb", basis: 34.2 },
    { id: "va", name: "Vantage", farbe: "#8957e5", basis: 28.6 },
    { id: "ha", name: "Halden",  farbe: "#1a7f5a", basis: 22.1 },
    { id: "ni", name: "Nimbus",  farbe: "#0e7490", basis: 17.4 },
    { id: "lu", name: "Lumen",   farbe: "#b3541e", basis: 13.2 },
    { id: "ve", name: "Verity",  farbe: "#be185d", basis: 9.6 },
    { id: "or", name: "Orbit",   farbe: "#9a6700", basis: 6.3 }
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

  function reihen(){
    var monate = monatsliste(), out = [];
    MARKEN.forEach(function(m, mi){
      /* Eine ruhige Welle je Marke statt eines Zufallsgangs. Der Zufallsgang liess sechs Punkte
         zappeln, und das sah nach Rauschen aus, nicht nach einer Messreihe. Eine Sinuswelle ueber
         etwa zwei Drittel einer Periode (0.85 rad je Schritt bei sechs Schritten) gibt genau einen
         Bogen -- ein Chart mit zwei vollen Wellen braucht mindestens ein Dutzend Punkte, und die
         haetten die Monatsnamen auf der Achse gekostet.
         Die Phase versetzt jede Marke, damit die Linien nicht im Gleichschritt laufen; der kleine
         Trend haelt die Reihenfolge in der Tabelle stabil. */
      var phase = mi * 1.05;
      monate.forEach(function(tag, ti){
        var welle = 1.9 * Math.sin(phase + ti * 0.85);
        var trend = (3 - mi) * 0.42 * ti;
        var wert = m.basis + welle + trend;
        out.push({ company_id: m.id, day: tag, visibility_pct: Math.max(0, Math.round(wert * 10) / 10) });
      });
    });
    return out;
  }

  /* Der letzte Monat gegen den davor -- so entstehen die Deltas in der Tabelle und in den
     Kennzahlen. Gerechnet und nicht erfunden, damit Kurve und Zahlen zusammenpassen: eine
     steigende Linie neben einem fallenden Pfeil ist genau die Art Widerspruch, die einem
     aufmerksamen Betrachter auffaellt. */
  function punkt(serie, id, index){
    var w = serie.filter(function(p){ return p.company_id === id; });
    var p = w[index < 0 ? w.length + index : index];
    return p ? p.visibility_pct : 0;
  }

  function tabelle(serie){
    return MARKEN.map(function(m, i){
      var jetzt = punkt(serie, m.id, -1);
      var davor = punkt(serie, m.id, -2);
      var rang = 1 + i * 0.8 + (i === 0 ? 0 : 0.3);
      return {
        company_id: m.id, name: m.name, logo_url: m.logo, position: i + 1,
        visibility_pct: Math.round(jetzt * 10) / 10,
        visibility_delta_pct: Math.round((jetzt - davor) * 10) / 10,
        avg_rank: Math.round(rang * 10) / 10,
        avg_rank_delta: [-0.3, 0.2, -0.1, 0.4, 0.1, -0.2, 0.3][i],
        sentiment: [79, 74, 71, 68, 66, 63, 58][i],
        sentiment_delta: [1.4, -0.8, 2.1, -1.6, 0.9, 0.5, -1.1][i]
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
      '<div class="ulh-text">' +
        '<h1 class="ulh-h1"><span>AI Search Analytics</span><span>Made simple</span></h1>' +
        '<p class="ulh-sub">Track and optimize your brand’s AI search performance and drive ' +
          '<b>Qualified Traffic</b>, <b>Leads</b>, and <b>Revenue</b>.</p>' +
      '</div>' +
      '<div class="ulh-stage">' +
        '<div class="ulh-frame">' +
          '<div class="ulh-chrome" aria-hidden="true">' +
            '<span class="ulh-dot"></span><span class="ulh-dot"></span><span class="ulh-dot"></span>' +
          '</div>' +
          '<div class="ulh-view">' +
            '<div class="ulh-app">' +
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
    var serie = reihen();
    var tab = tabelle(serie);
    var eigene = tab[0];

    if (window.setSidebarTeams){
      window.setSidebarTeams(ID.usn, [{ id: "t1", name: "Kestrel", domain: "kestrel.example", favicon_url: "" }]);
      window.setSidebarUser(ID.usn, { name: "Alex Moreno", email: "alex@kestrel.example", avatar_url: "" });
      if (window.setUpstreemBrands) window.setUpstreemBrands(MARKEN.map(function(m){
        return { company_id: m.id, name: m.name };
      }));
      if (window.setSidebarCount) window.setSidebarCount(ID.usn, 128);
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
        companies: MARKEN.map(function(m, i){
          return { company_id: m.id, name: m.name, color: m.farbe, favicon_url: m.logo,
                   visibility_window_pct: tab[i].visibility_pct };
        }),
        filterCompanies: MARKEN.map(function(m){
          return { company_id: m.id, name: m.name, color: m.farbe, favicon_url: m.logo };
        }),
        table: tab,
        totalCount: MARKEN.length,
        granularity: "month"
      });
    }

    if (window.renderTopCitations){
      window.renderTopCitations({
        instanceId: ID.tcd,
        mode: "domain",
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
      setTimeout(function(){ hellHalten(root); mass(root); }, ms);
    });
    var n = 0;
    (function warte(){
      if (bereit()){
        try { fuellen(); } catch (e){ if (window.console) console.warn("[landing-hero]", e); }
        hellHalten(root);
        /* Die Leiste entsteht erst, wenn core ihre Wurzel gesehen hat -- das kann nach dem Setter
           liegen. Also nachfassen, bis sie da ist, und dann noch einmal messen. */
        (function holen(k){
          if (leisteHolen(root)){ mass(root); return; }
          if (k < 40) setTimeout(function(){ holen(k + 1); }, 100);
        })(0);
        /* Nach dem Fuellen noch einmal messen: die Tabellen bringen ihre Hoehe erst mit den
           Daten, und die Buehne muss den Ausschnitt danach immer noch fuellen. */
        mass(root);
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
