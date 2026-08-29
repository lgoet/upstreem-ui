/* upstreem domain-detail.js — die Domain-Detailseite. Braucht core.js (window.UpstreemCore).

   Drei Abschnitte in einer Wurzel, von oben:
     1. Umschalter (Citation Share / Domain Share) ueber einer Karte mit Kopfzeile, KPI und Kurve.
        Aufbau, Masse und Verhalten sind die von brand-detail -- dieselbe Karte, andere Daten.
     2. "Source Funnel": vier Stufen als Trichter.
     3. "Model Breakdown": Balkenliste je Modell.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.makeLine + UC.buildLineDatasets   die Kurve samt Tooltip, Legende, Skelett
     UC.makeTypeChart                     BEIDE Charts der unteren Zeile: URL-Typen und Modelle,
                                          je als Ring oder Balken. Ein Baustein, eine Bewegung.
     UC.trendChip / UC.fmtPct / UC.fmtTotal   die Formate
     UC.typeColor                         die Farbe des Zitationstyps, hell wie dunkel
     UC.makeMount / makeFire / makeLate / parseLoose / widthTiers / onTheme / themeParam

   Neu ist nur der Trichter. Fuer den gibt es in core nichts, und es gibt ihn genau einmal in der
   App -- deshalb steht er hier und nicht dort. Er ist als SVG gezeichnet und nicht mit Chart.js:
   vier weiche Uebergaenge sind vier Bezier-Kurven, und Chart.js kennt keinen Trichtertyp. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setDomainDetail", "setDomainDetailUrls", "setDomainDetailLoading",
                   "resetDomainDetail"];
  var Q = (window.__uddBootQueue = window.__uddBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uddBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uddBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uddStart();
  }

  function uddStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;

  var MODES = [
    { key: "citation", label: "Citation Share", heading: "Citations Share over Time" },
    /* Die Ueberschrift heisst URL Share, weil genau das gezeigt wird: wie sich die Zitationen
       dieser Domain auf ihre einzelnen URLs verteilen. "Domain Share" las sich wie der Anteil der
       Domain am Gesamtmarkt -- das ist die Kurve daneben. Der Knopf heisst weiter "Domain Share",
       er waehlt den Datensatz und nicht die Sicht darauf. */
    /* Der Knopf heisst "URL Share", nicht mehr "Domain Share": er waehlt dieselbe Sicht, die die
       Ueberschrift benennt, und zwei Namen fuer eine Sache sind einer zu viel. */
    { key: "domain",   label: "URL Share",      heading: "URL Share over Time",
      info: "How this domain's citations are split across its own URLs. Each line is one URL, " +
            "and its value is that URL's share of all citations this domain received in the " +
            "period -- so the lines add up to 100%. It answers which pages of the domain the " +
            "models actually cite, not how the domain compares to other domains." }
  ];
  /* D, W und M statt der ganzen Woerter -- der ganze Name steht im Tooltip. Dieselbe Form,
     die core allen Umschaltern dieser Art gibt (stampGran); hier steht sie direkt im Markup,
     damit beim ersten Bild nicht kurz das lange Wort aufblitzt. */
  var GRANS  = [{ key: "day", label: "D", tip: "Day" }, { key: "week", label: "W", tip: "Week" },
                { key: "month", label: "M", tip: "Month" }];
  /* Global heisst: der Anteil dieser URL an ALLEN Zitationen. Domain: ihr Anteil innerhalb dieser
     Domain. Beides kommt aus dem Payload (share_pct), der Schalter sagt Bubble nur, welche Zahl
     der naechste Aufruf liefern soll. */
/* Der Bezug ist ab jetzt immer "domain": die Kurve zeigt die Verteilung der Zitationen dieser
   Domain auf ihre eigenen URLs, und dafuer gibt es keine zweite Lesart. Der Umschalter Global/Domain
   ist damit weg. Die Konstante bleibt, weil jedes Ereignis nach Bubble weiterhin einen scope traegt
   und die RPC ihn erwartet -- ein Feld, das plotzlich fehlt, bricht dort still. */
  var SCOPE_FEST = "domain";

  /* Die vier Stufen des Trichters. `wert` holt die Zahl aus dem Payload, `unter` die Zeile
     darunter. Reihenfolge ist die Erzaehlung: wie oft wird die Quelle zitiert, wie viele Seiten
     davon, wie viele nennen ueberhaupt eine verfolgte Marke, wie viele die eigene. */
  /* Drei Stufen, nicht vier. "Responses citing this domain" ist raus: die Stufe zaehlt Antworten,
     die drei anderen zaehlen URLs. Ein Trichter, dessen erste Stufe eine andere Einheit hat als
     der Rest, behauptet ein Verhaeltnis, das es nicht gibt -- und weil die Hoehe jeder Stufe ihr
     Anteil an der ERSTEN ist, war die Verjuengung danach willkuerlich. */
  var STUFEN = [
    { key: "urls", label: "Cited Pages / URLs",
      wert: function (f) { return f.cited_urls_count; },
      unter: function () { return "URLs"; } },
    { key: "tracked", label: "URLs mentioning tracked brands",
      wert: function (f) { return f.urls_with_tracked_brands; },
      unter: function (f) { return UC.fmtPct(f.tracked_brand_presence_pct, 1) + " of cited URLs"; } },
    { key: "you", label: "URLs mentioning {brand}",
      wert: function (f) { return f.urls_mentioning_you; },
      unter: function (f) { return UC.fmtPct(f.your_url_presence_pct, 1) + " of cited URLs"; } }
  ];

  /* Die Bereiche der Seite lassen sich nicht mehr ausblenden. Das Zahnrad und seine Liste sind
     entfallen: die Anordnung ist eine Entscheidung des Entwurfs, und die vier Karten gehoeren
     zusammen -- eine Seite, auf der die Haelfte fehlt, beantwortet die Frage nicht mehr, fuer die
     es sie gibt. Was der frueheren Einstellung noch in der Ablage steht, wird beim Start
     geloescht (siehe altenLayoutschluesselLoeschen). */

  /* Der Modus (Citation Share / URL Share) ueberlebt jetzt den Seitenaufbau: er liegt im
     localStorage ueber UC.prefGet/prefSet, nicht mehr nur im Fenster. Eine Ansichtsvorliebe gehoert
     dem Nutzer, nicht dem Seitenbesuch -- wer zuletzt URL Share angesehen hat, will das morgen
     wieder sehen. Das Fenster-Objekt bleibt als schneller Zwischenspeicher davor: mehrere Kopien
     derselben Instanz auf einer Seite sollen sich nicht ueber den Speicher unterhalten muessen. */
  var MODE_STORE = (window.__uddMode = window.__uddMode || {});
  var MODE_KEY = "uddMode__";
  function modusLesen(id){
    if (MODE_STORE[id]) return MODE_STORE[id];
    var v = null;
    try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(MODE_KEY + id) : MODE_KEY + id) : null; } catch (e) {}
    return (v === "citation" || v === "domain") ? v : null;
  }
  function modusSchreiben(id, m){
    MODE_STORE[id] = m;
    try { if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(MODE_KEY + id) : MODE_KEY + id, m); } catch (e) {}
  }
  var GRAN_STORE = (window.__uddGran = window.__uddGran || {});
/* Der Speicher fuer den Bezug: es gibt nur noch "domain", also merkt er nichts mehr. Er bleibt
   stehen, weil eine andere Fassung derselben Datei auf einer Seite daneben liegen kann und dann
   auf window.__uddScope zugreift -- ein Objekt, das plotzlich fehlt, wirft dort. */
  var SCOPE_STORE = (window.__uddScope = window.__uddScope || {});
  var CHART_STORE = (window.__uddChart = window.__uddChart || {});
  var MCHART_STORE = (window.__uddMChart = window.__uddMChart || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { return UC.toNum(v); }

  /* ---- Farben ---------------------------------------------------------------------------------
     Die Kurve im Citation-Share-Modus traegt die Farbe des Zitationstyps dieser Domain -- dieselbe,
     die der Typ in jeder Tabelle und im Combo-Chart hat (UC.typeColor).
     Fuer den Domain-Share-Modus braucht es mehrere Farben aus derselben Familie. Die Skala des
     Typs hat nur EINE Farbe, also wird sie erweitert: gleicher Farbton, gestaffelte Helligkeit und
     Saettigung. Das haelt die Kurven als Familie zusammen und unterscheidet sie trotzdem --
     und es funktioniert fuer jeden Typ, auch fuer einen, den es heute noch nicht gibt. */
  function hexZuHsl(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), hu = 0;
    if (d !== 0) {
      if (max === r) hu = ((g - b) / d) % 6;
      else if (max === g) hu = (b - r) / d + 2;
      else hu = (r - g) / d + 4;
      hu *= 60; if (hu < 0) hu += 360;
    }
    return { h: hu, s: s, l: l };
  }
  /* Fuenf Stufen um die Grundfarbe herum, im Dunkeln heller angesetzt als im Hellen -- dieselbe
     Richtung, in die core seine Chart-Paletten zwischen den Themen verschiebt. */
  var RAMPE_HELL   = [0, -0.10, 0.10, -0.20, 0.18, -0.28, 0.26];
  var RAMPE_DUNKEL = [0, 0.10, -0.10, 0.20, -0.18, 0.28, -0.26];
  function familie(basis, n, dunkel) {
    var hsl = hexZuHsl(basis);
    var out = [];
    var rampe = dunkel ? RAMPE_DUNKEL : RAMPE_HELL;
    for (var i = 0; i < n; i++) {
      if (!hsl) { out.push(basis); continue; }
      var d = rampe[i % rampe.length];
      var l = Math.min(0.82, Math.max(0.22, hsl.l + d));
      /* Die Saettigung wandert gegenlaeufig mit: eine sehr helle Linie mit voller Saettigung
         wirkt grell, eine sehr dunkle mit wenig Saettigung wird zu Grau. */
      var s = Math.min(0.85, Math.max(0.28, hsl.s - Math.abs(d) * 0.25));
      out.push("hsl(" + Math.round(hsl.h) + "," + Math.round(s * 100) + "%," + Math.round(l * 100) + "%)");
    }
    return out;
  }

  /* ============================================================================================
     Markup. Wie in brand-detail und performance-detail baut die Komponente ihren Innenaufbau
     selbst -- es gibt im Bubble-Element keine Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      /* .up-seg/.up-seg-btn und .vc-gran/.vc-gran-btn sind die Haus-Bauteile aus core.css. Hier
         steht nur die Positionierung, kein eigenes Aussehen. */
      '<div class="udd-card udd-chartcard">' +
        '<div class="udd-head">' +
          '<div class="udd-title">' +
            /* Der Umschalter steht an der Stelle, an der die Ueberschrift stand: er sagt
               dasselbe kuerzer. "URL Share over Time" darueber und "URL Share" als aktiver Knopf
               daneben waren zweimal derselbe Satz, und die Zeile darueber, in der er vorher
               stand, war danach leer. */
            '<div class="up-seg is-lg udd-seg" role="tablist" aria-label="Chart mode">' +
              MODES.map(function (m) {
                return '<button class="up-seg-btn" type="button" role="tab" data-mode="' + m.key + '">' +
                         esc(m.label) + '</button>';
              }).join("") +
            '</div>' +
            /* Der Erklaerer der Tabellenkoepfe, nicht der kurze Tooltip: .up-th-info mit
               data-explain, und die Karte baut UC.makeExplain. Ein data-tip haette denselben Text
               in der falschen Form gezeigt -- eine Zeile Text an der Maus statt der Karte mit
               Ueberschrift, Beispielbild und Satz, die jede Spaltenerklaerung dieser App hat.
               Beide Ueberschriften bekommen einen: die Kurve wechselt ihre Bedeutung mit dem
               Modus, und dann muss auch die Erklaerung wechseln. */
            '<span class="up-th-info udd-info" data-explain="chart"></span>' +
          '</div>' +
          '<div class="udd-tools">' +
            '<div class="vc-gran" role="group" aria-label="Granularity">' +
              GRANS.map(function (g) {
                return '<button class="vc-gran-btn" type="button" data-gran="' + g.key +
                  '" data-tip="' + esc(g.tip) + '" aria-label="' + esc(g.tip) + '">' + esc(g.label) + '</button>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="udd-kpi">' +
          '<span class="udd-kpi-val"></span>' +
          '<span class="udd-kpi-trend"></span>' +
        '</div>' +
        '<div class="udd-chartwrap"><canvas class="udd-canvas"></canvas></div>' +
        '<div class="udd-legend up-legend"></div>' +
      '</div>' +

      '<div class="udd-card udd-funnelcard">' +
        '<div class="udd-sec">' +
          '<span class="udd-sec-title">Source Funnel</span>' +
          '<span class="udd-sec-desc">How often this source is cited, how many of its cited URLs ' +
            'mention brands, and where your brand is still missing</span>' +
        '</div>' +
        '<div class="udd-funnel"></div>' +
      '</div>' +

      /* Typ-Split und Model Breakdown stehen nebeneinander in einer Zeile. Das Typ-Chart ist
         hoeher als die Balkenliste (ein Doughnut braucht seine Flaeche), deshalb richtet die Zeile
         mittig aus statt oben -- sonst haengt die Balkenliste am Kopf der Zeile. */
      '<div class="udd-row2">' +
        '<div class="udd-card udd-typecard">' +
          '<div class="udd-sec udd-sec-row">' +
            '<div class="udd-sec-txt">' +
              '<span class="udd-sec-title">URL Type Split</span>' +
              '<span class="udd-sec-desc">What kind of pages of this domain get cited</span>' +
            '</div>' +
            /* .cc-seg / .cc-seg-btn sind die Alias-Klassen von .up-seg / .up-seg-btn -- dasselbe
               Bauteil wie im Combo-Chart, damit der Umschalter ueberall gleich aussieht. */
            '<div class="cc-seg udd-typeseg" role="tablist" aria-label="Chart type">' +
              '<button class="cc-seg-btn" type="button" role="tab" data-chart="doughnut"' +
                ' data-tip="Doughnut" aria-label="Doughnut">' + UC.icon("donut", 2) + '</button>' +
              '<button class="cc-seg-btn" type="button" role="tab" data-chart="bar"' +
                ' data-tip="Bars" aria-label="Bars">' + UC.icon("chartBarDec", 2) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="udd-typebody up-donut-body"></div>' +
        '</div>' +

        '<div class="udd-card udd-modelcard">' +
          '<div class="udd-sec udd-sec-row">' +
            '<div class="udd-sec-txt">' +
              '<span class="udd-sec-title">Model Breakdown</span>' +
              '<span class="udd-sec-desc">Distribution of this domain in AI models</span>' +
            '</div>' +
            '<div class="cc-seg udd-modelseg" role="tablist" aria-label="Chart type">' +
              '<button class="cc-seg-btn" type="button" role="tab" data-mchart="doughnut"' +
                ' data-tip="Doughnut" aria-label="Doughnut">' + UC.icon("donut", 2) + '</button>' +
              '<button class="cc-seg-btn" type="button" role="tab" data-mchart="bar"' +
                ' data-tip="Bars" aria-label="Bars">' + UC.icon("chartBarDec", 2) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="udd-modelbody udd-modeldonut up-donut-body"></div>' +
        '</div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__uddController) return root.__uddController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();
    var fire = UC.makeFire(root, { label: "domain-detail", eventPrefix: "udd" });

    /* Schmale Breiten ueber die EIGENE Box, nicht ueber eine Media Query auf das Fenster: diese
       Seite kann in einem Drawer stehen, der auf einem breiten Bildschirm schmal ist. */
    /* stackAt 900: DARUNTER stehen die vier Karten untereinander. Der Wert kommt aus der
       Haelfte: bei 900 ist eine Spalte 442px breit, und darin steht der Trichter mit seinen drei
       Zahlen noch nebeneinander. Darunter nicht mehr. narrow/vnarrow bleiben, wo sie waren -- sie
       regeln das Innere der Karten, nicht ihre Anordnung. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 640, vnarrowAt: 480, stackAt: 900 });

    var elSeg     = root.querySelector(".udd-seg");
    var elInfo    = root.querySelector(".udd-info");
    var elGran    = root.querySelector(".vc-gran");
    var elKpi     = root.querySelector(".udd-kpi");
    var elVal     = root.querySelector(".udd-kpi-val");
    var elTrend   = root.querySelector(".udd-kpi-trend");
    var elChart   = root.querySelector(".udd-chartwrap");
    var elCanvas  = root.querySelector(".udd-canvas");
    var elLegend  = root.querySelector(".udd-legend");
    var elFunnel  = root.querySelector(".udd-funnel");
    var elTypeBody = root.querySelector(".udd-typebody");
    var elTypeSeg  = root.querySelector(".udd-typeseg");
    var elModelSeg = root.querySelector(".udd-modelseg");
    var elModelDonut = root.querySelector(".udd-modeldonut");

    /* UC.themeParam und nicht das Attribut allein: kennt core ein Thema, gewinnt core. Das
       Attribut ist die Momentaufnahme aus dem Lauf des Workflows. */
    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    function darkNow() { return isDark; }

    /* Die Tooltips fehlten hier komplett -- makeTooltips wurde nie gerufen, also blieb JEDES
       data-tip dieser Komponente stumm: Zahnrad, Ring/Balken-Umschalter, alle. Der zweite
       Parameter ist die Themenabfrage; ohne ihn steht der Tooltip im Dunkeln hell. */
    if (UC.makeTooltips) UC.makeTooltips(root, darkNow);

    /* Kam der Modus aus localStorage statt aus dieser Seitensitzung, hat auf DIESER Seite noch
       nie jemand die URL-Serie angefordert -- der Klick, der das sonst tut, hat nie
       stattgefunden. Unten wird sie deshalb genau einmal selbst angefordert. Die Unterscheidung
       muss hier fallen, VOR dem ersten modusSchreiben: danach ist der Speicher gefuellt und der
       Fall nicht mehr von einer Neueinspritzung durch Bubble zu unterscheiden. */
    var modusAusSpeicher = !MODE_STORE[instanceId];

    var state = {
      mode:  modusLesen(instanceId)  || "citation",
      gran:  GRAN_STORE[instanceId]  || "day",
      scope: SCOPE_FEST,
      header: null, share: null, urls: null, model: null, funnel: null,
      brand: (root.getAttribute("data-brand") || "").trim(),
      /* loading startet auf true: die Komponente steht auf der Seite, bevor der Pageload-Workflow
         gelaufen ist, und in dieser Zeit LAEDT sie -- sie ist nicht leer. Beendet wird der Zustand
         durch die Daten oder nach WARTE_MS durch die Warte-Uhr, nie durch nichts. */
      loading: true, hasData: false, error: null,
      /* Die URL-Serie kommt aus einem EIGENEN Workflow, ausgeloest durch einen Klick. Deshalb hat
         sie ihren eigenen Wartezustand: urls === null heisst "noch nie etwas angekommen",
         urlsStale heisst "wir haben etwas, aber gerade neue Zahlen angefordert". Beides ist
         WARTEN und muss ein Skelett zeigen -- nicht "No URL data", denn das ist eine Aussage
         ueber die Daten und nicht ueber uns. urlsError ist das Ende der Geduld. */
      urlsStale: false, urlsError: null,
      /* Der Umschalter des Typ-Charts. Wie in Combo und Topcitations ist der Doughnut der Anfang;
         der Balkenmodus ist die Ansicht fuer viele Typen. Ueberlebt das Neueinspritzen. */
      chartMode: CHART_STORE[instanceId] || "doughnut",
      /* Beim Model Breakdown ist der BALKEN der Anfang (Vorgabe): zwei oder drei Modelle sind als
         Balken mit Logo und Prozentwert schneller zu lesen als als Ring. */
      modelMode: MCHART_STORE[instanceId] || "bar",
      types: null
    };
    if (state.brand === "BRAND_NAME") state.brand = "";

    /* Die frueher gespeicherte Sichtbarkeit der Bereiche wird EINMAL geloescht statt nur
       ignoriert. Wer damit das Chart oder den Trichter versteckt hatte, saehe die Seite sonst
       weiterhin halb -- und ohne Zahnrad gaebe es keinen Weg zurueck. Geloescht wird auch die
       Altform mit angehaengter Kennung: prefGet liest sie noch (Schluessel + "@..."), also muss
       sie hier genauso weg. */
    (function altenLayoutschluesselLoeschen() {
      try {
        var ls = window.localStorage;
        if (!ls) return;
        var weg = [];
        for (var i = 0; i < ls.length; i++) {
          var n = ls.key(i);
          if (n && n.indexOf("uddLayout") === 0) weg.push(n);
        }
        weg.forEach(function (n) { try { ls.removeItem(n); } catch (e) {} });
      } catch (e) {}
    })();

    /* ---- Der Erklaerer an der Ueberschrift -----------------------------------------------------
       Dieselbe Karte wie in den Tabellenkoepfen (UC.makeExplain, .up-explain): Ueberschrift,
       Beispielbild, Satz. Der Inhalt haengt am Modus, weil die Kurve mit dem Modus ihre Bedeutung
       wechselt -- ein Text fuer beide waere fuer einen von beiden falsch. */
    /* Das Beispielbild oben in der Karte. Es fehlte -- und genau daran war zu sehen, dass es NICHT
       dieselbe Karte war wie in den Tabellenkoepfen: dort steht ueber Ueberschrift und Satz ein
       heller Block mit einem Beispiel, und ohne ihn sieht die Karte aus wie ein blosser Tooltip.
       Die Beispiele zeigen, was in der jeweiligen Kurve wirklich steht: beim Zitationsanteil ein
       Wert mit Veraenderung, beim URL-Anteil zwei Werte, die sich zu hundert ergaenzen. */
    /* Dieselben zwei Pfeile, die die Tabellen in ihren Erklaerkarten benutzen (UC.TREND_UP /
       TREND_DOWN) -- nicht selbst gezeichnet, damit das Beispielbild wirklich dasselbe ist. */
    var TREND_HOCH = UC.TREND_UP || "", TREND_RUNTER = UC.TREND_DOWN || "";
    var ERKLAERUNG = {
      citation: {
        vis: '<span class="up-explain-row">11.3%' +
               '<span class="up-explain-up">' + TREND_HOCH + '</span>' +
               '<span class="up-explain-up">2.4%</span></span>' +
             '<span class="up-explain-row">8.9%' +
               '<span class="up-explain-down">' + TREND_RUNTER + '</span>' +
               '<span class="up-explain-down">1.1%</span></span>',
        h: "Citations Share over Time",
        t: "How much of all citations in the period went to this domain, day by day. It compares " +
           "this domain against every other domain, so the value falls when others are cited more."
      },
      domain: {
        vis: '<span class="up-explain-row">/pricing<span style="margin-left:auto">62.0%</span></span>' +
             '<span class="up-explain-row">/blog/guide<span style="margin-left:auto">38.0%</span></span>',
        h: "URL Share over Time",
        t: "How this domain's citations are split across its own URLs. Each line is one URL, and " +
           "its value is that URL's share of all citations this domain received -- so the lines " +
           "add up to 100%. It says which pages get cited, not how the domain compares to others."
      }
    };
    /* html(key) statt eines festen Textes: der Schluessel ist immer "chart", die Antwort haengt am
       aktuellen Modus. Die Karte fragt bei jedem Oeffnen neu, also stimmt sie auch nach einem
       Moduswechsel ohne dass hier jemand etwas nachziehen muss. */
    if (UC.makeExplain) UC.makeExplain({
      root: root, getIsDark: darkNow,
      html: function () {
        var e = ERKLAERUNG[state.mode] || ERKLAERUNG.citation;
        return (e.vis ? '<div class="up-explain-vis">' + e.vis + '</div>' : "") +
               '<div class="up-explain-h">' + esc(e.h) + '</div>' +
               '<div class="up-explain-t">' + esc(e.t) + '</div>';
      }
    });

    /* ---- Ein Wartezustand, der endet ---------------------------------------------------------
       Das Skelett laeuft, solange keine Daten da sind. Ohne Ende ist "kommt gleich" nicht von
       "kommt nie" zu unterscheiden -- dieselbe Uhr wie in brand-detail, dieselbe Dauer. */
    var WARTE_MS = 25000, warteUhr = null, urlUhr = null;
    function warteStarten() {
      if (warteUhr) clearTimeout(warteUhr);
      warteUhr = setTimeout(function () {
        warteUhr = null;
        if (state.hasData || state.error) return;
        /* Unsichtbar heisst: diese Seite ist gar nicht offen, Bubble haelt sie nur im DOM. Dann
           wartet niemand, und "No data" jetzt zu setzen hiesse, es steht beim spaeteren Oeffnen
           der Seite schon da, bevor der Pageload-Workflow ueberhaupt laufen konnte. */
        if (!UC.istSichtbar(root)) { warteStarten(); return; }
        state.error = "No data";
        state.loading = false;
        render();
      }, WARTE_MS);
    }
    function warteBeenden() { if (warteUhr) { clearTimeout(warteUhr); warteUhr = null; } }
    warteStarten();
    /* Bubble spritzt das Markup neu ein, der Modus ueberlebt in MODE_STORE und ueber
       localStorage sogar das Seitenneuladen. Startet die Instanz also schon im URL Share, ist
       die Serie von der ersten Sekunde an unterwegs.

       Angefordert wird sie nur beim Wert aus localStorage: dann ist die Seite frisch und der
       Ladeschritt der Seite kennt nur die Zitationsdaten -- ohne diese Anforderung stuende das
       Chart nach der Wartezeit auf "No data". Bei einer blossen Neueinspritzung wird NICHT
       angefordert: der Workflow lief schon, und ein Ereignis, das eine erneute Einspritzung
       ausloest, waere eine Schleife. Ein Tick Verzoegerung, damit der Workflow gebunden ist. */
    MODE_STORE[instanceId] = state.mode;
    if (state.mode === "domain") setTimeout(function () {
      if (state.urls) return;
      urlWarteStarten();
      if (modusAusSpeicher) fire("data-mode-fn", "uddMode",
        { mode: state.mode, gran: state.gran, scope: state.scope });
    }, 0);

    /* Dieselbe Geduld fuer die URL-Serie, aber getrennt gezaehlt: sie wird spaeter und oefter
       angefordert als die Hauptdaten, und ihr Ausbleiben darf nur ihr eigenes Chart betreffen. */
    function urlWarteStarten() {
      state.urlsError = null;
      if (urlUhr) clearTimeout(urlUhr);
      urlUhr = setTimeout(function () {
        urlUhr = null;
        if (!urlWartet()) return;
        /* Siehe Hauptuhr oben: unsichtbar heisst, die Seite ist gar nicht offen. */
        if (!UC.istSichtbar(root)) { urlWarteStarten(); return; }
        state.urlsError = "No data";
        state.urlsStale = false;
        renderChart();
      }, WARTE_MS);
    }
    function urlWarteBeenden() { if (urlUhr) { clearTimeout(urlUhr); urlUhr = null; } }
    /* Warten heisst: nichts da ODER angefordert. Der Fehlerfall ist kein Warten mehr. */
    function urlWartet() { return !state.urlsError && (!state.urls || state.urlsStale); }

    /* ---- Kurve ------------------------------------------------------------------------------ */
    var line = UC.makeLine({
      wrap: elChart, canvas: elCanvas, legend: elLegend,
      isDark: darkNow, isOwner: function () { return true; },
      gran: function () { return state.gran; },
      unit: "%",
      /* Eine Nachkommastelle: das ist die Genauigkeit, in der die Anteile geliefert werden. */
      decimals: 1,
      tipLabel: "Share:",
      watermark: true
    });

    /* ---- Trichter ----------------------------------------------------------------------------
       Vier Stufen. Die Hoehe jeder Stufe ist ihr Anteil an der ERSTEN Stufe, mit einer Untergrenze,
       damit eine Stufe mit dem Wert 0 nicht verschwindet -- sie ist die Aussage "hier ist nichts",
       und die muss man sehen koennen.
       Gezeichnet als EIN Pfad je Stufe: oben eine weiche Kurve von der Hoehe der Stufe zur naechsten,
       unten die Grundlinie. Die Kurve ist ein kubischer Bezier mit waagerechten Anfassern -- so
       laeuft sie an beiden Enden waagerecht aus und die Stufen gehen ohne Knick ineinander ueber. */
    var FN_H = 132;         /* Zeichenhoehe des Trichters in Einheiten des viewBox */
    var FN_MIN = 0.06;      /* kleinste sichtbare Hoehe, als Anteil */
    function trichterHtml(f) {
      var stufen = STUFEN.map(function (s) {
        var v = num(s.wert(f));
        return {
          key: s.key,
          label: s.label.replace("{brand}", state.brand || "your brand"),
          wert: v == null ? 0 : v,
          unter: s.unter(f)
        };
      });
      var basis = stufen[0].wert || 0;
      var farbe = typFarbe();
      var hoehen = stufen.map(function (s) {
        var a = basis > 0 ? (s.wert / basis) : 0;
        return Math.max(FN_MIN, Math.min(1, a));
      });
      var breite = 100, proStufe = breite / stufen.length;
      var pfade = "";
      for (var i = 0; i < stufen.length; i++) {
        var x0 = i * proStufe, x1 = (i + 1) * proStufe;
        var h0 = hoehen[i] * FN_H;
        var h1 = (i + 1 < hoehen.length ? hoehen[i + 1] : hoehen[i]) * FN_H;
        var y0 = FN_H - h0, y1 = FN_H - h1;
        var cx = x0 + proStufe / 2;
        /* Deckkraft stuft sich ab: die erste Stufe ist die volle Menge, jede weitere ein Rest
           davon. Eine eigene Farbe je Stufe waere eine zweite Aussage -- hier geht es nur um
           "immer weniger". */
        var deck = 0.92 - i * 0.18;
        pfade += '<path class="udd-fn-band" d="M' + x0 + ',' + y0 +
                 ' C' + cx + ',' + y0 + ' ' + cx + ',' + y1 + ' ' + x1 + ',' + y1 +
                 ' L' + x1 + ',' + FN_H + ' L' + x0 + ',' + FN_H + ' Z"' +
                 ' fill="' + esc(farbe) + '" fill-opacity="' + deck.toFixed(2) + '"></path>';
      }
      var trenner = "";
      for (var t = 1; t < stufen.length; t++) {
        trenner += '<line class="udd-fn-div" x1="' + (t * proStufe) + '" y1="0" x2="' + (t * proStufe) + '" y2="' + FN_H + '"></line>';
      }
      var kopf = stufen.map(function (s) {
        return '<div class="udd-fn-col">' +
                 '<span class="udd-fn-val">' + esc(UC.fmtTotal(s.wert)) + '</span>' +
                 '<span class="udd-fn-label">' + esc(s.label) + '</span>' +
                 '<span class="udd-fn-sub">' + esc(s.unter) + '</span>' +
               '</div>';
      }).join("");
      return '<div class="udd-fn-head">' + kopf + '</div>' +
             '<svg class="udd-fn-svg" viewBox="0 0 ' + breite + ' ' + FN_H + '" preserveAspectRatio="none" ' +
                  'aria-hidden="true">' + pfade + trenner + '</svg>';
    }

    /* ---- Farbe des Zitationstyps ------------------------------------------------------------- */
    function typFarbe() {
      var t = state.header && state.header.citation_type;
      return UC.typeColor(t || "", "citation", isDark);
    }

    /* ---- Render ------------------------------------------------------------------------------ */
    function modeOf(k) { for (var i = 0; i < MODES.length; i++) if (MODES[i].key === k) return MODES[i]; return MODES[0]; }

    function syncSeg() {
      [].forEach.call(elSeg.querySelectorAll(".up-seg-btn"), function (b) {
        var on = b.getAttribute("data-mode") === state.mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      [].forEach.call(elGran.querySelectorAll(".vc-gran-btn"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-gran") === state.gran);
      });
      /* Die KPI-Zeile ist die des globalen Anteils -- im URL-Share nimmt die Kurve ihren Platz ein. */
      var domainModus = state.mode === "domain";
      elKpi.hidden = domainModus;
      if (elInfo && !elInfo.innerHTML) elInfo.innerHTML = UC.icon("info", 2);
      root.classList.toggle("is-domainshare", domainModus);
    }

    /* Die Kopfzeile der Chart-Karte traegt nur noch den Umschalter. Das Favicon der Domain stand
       davor und ist entfallen: welche Domain man ansieht, sagt die Seite darueber, und im
       Umschalter selbst hatte es nichts zu suchen. Damit gibt es hier auch nichts mehr zu
       zeichnen -- die frueheren Skelett- und Rueckfallwege des Zeichens sind mit ihm weg. */

    function renderKpi() {
      if (state.error) {
        elVal.innerHTML = '<span class="up-num is-empty">–</span>';
        elTrend.innerHTML = "";
        return;
      }
      if (istLaden() || !state.hasData) {
        elVal.innerHTML = '<span class="up-tsk-bar"></span>';
        elTrend.innerHTML = '<span class="up-tsk-bar"></span>';
        return;
      }
      var h = state.header || {};
      var v = num(h.current_citation_share);
      elVal.innerHTML = '<span class="up-num' + (v == null ? " is-empty" : "") + '">' +
        (v == null ? "–" : esc(UC.fmtPct(v, 1))) + '</span>';
      /* Mit Prozentzeichen und einer Nachkommastelle: der Wert ist die Veraenderung eines
         ANTEILS, und so steht er auch in jeder Tabelle (siehe die Share-Spalten). */
      elTrend.innerHTML = UC.trendChip(h.citation_share_delta_pct, { decimals: true, suffix: "%" });
    }

    function istLaden() { return !!state.loading; }

    function renderChart() {
      if (state.error) { line.empty(state.error); return; }
      if (istLaden() || !state.hasData) { line.skeleton(); return; }

      if (state.mode === "citation") {
        var reihe = isArr(state.share) ? state.share : [];
        if (!reihe.length) { line.empty("No citation share for this period."); return; }
        var id = (state.header && (state.header.domain || state.header.id)) || "domain";
        var punkte = reihe.map(function (p) {
          return { company_id: id, day: p.day, share_pct: num(p.share_pct) };
        });
        var built = UC.buildLineDatasets(punkte, [{
          company_id: id,
          name: id,
          color: typFarbe(),
          favicon_url: (state.header && (state.header.favicon || state.header.favicon_url)) || ""
        }], null);
        line.render(built);
        return;
      }

      /* Reihenfolge wie in CLAUDE.md §2: erst der Fehler, dann das Skelett, dann die Aussage
         ueber die Daten. Vorher stand hier nur die Aussage -- ein Klick auf "Domain Share"
         zeigte "No URL data for this period.", solange der Workflow lief, also genau in dem
         Moment, in dem noch niemand etwas ueber die Daten wissen konnte. */
      if (state.urlsError) { line.empty(state.urlsError); return; }
      if (urlWartet()) { line.skeleton(); return; }
      var pts = state.urls && isArr(state.urls.points) ? state.urls.points : [];
      if (!pts.length) { line.empty("No URL data for this period."); return; }
      /* Eine Farbe je URL, aus der Familie des Zitationstyps -- siehe familie(). Die Reihenfolge
         richtet sich nach dem Gesamtanteil, damit die staerkste Kurve immer dieselbe Farbe hat
         und nicht bei jedem Neuladen springt. */
      var meta = {}, reihenfolge = [];
      pts.forEach(function (p) {
        var u = String(p.url || "");
        if (!u) return;
        if (!meta[u]) {
          meta[u] = { company_id: u, name: p.title || u, gesamt: num(p.share_total_pct) || 0 };
          reihenfolge.push(u);
        }
      });
      reihenfolge.sort(function (a, b) { return meta[b].gesamt - meta[a].gesamt; });
      var farben = familie(typFarbe(), reihenfolge.length, isDark);
      var companies = reihenfolge.map(function (u, i) {
        meta[u].color = farben[i];
        return meta[u];
      });
      var punkte2 = pts.map(function (p) {
        return { company_id: String(p.url || ""), day: p.day, share_pct: num(p.share_pct) };
      });
      line.render(UC.buildLineDatasets(punkte2, companies, null));
    }

    function renderFunnel() {
      if (state.error) { elFunnel.innerHTML = '<div class="up-chart-empty">' + esc(state.error) + '</div>'; return; }
      if (istLaden() || !state.funnel) {
        elFunnel.innerHTML = '<div class="udd-fn-sk">' +
          '<span class="udd-fn-sk-head"></span><span class="udd-fn-sk-body"></span></div>';
        return;
      }
      elFunnel.innerHTML = trichterHtml(state.funnel);
      /* Die Spaltenzahl des Kopfrasters an die Zahl der Stufen binden -- das SVG teilt die Breite
         durch dieselbe Zahl, also muessen die Koepfe darueber genau daraufliegen. */
      var kopf = elFunnel.querySelector(".udd-fn-head");
      if (kopf) kopf.style.setProperty("--udd-fnc", String(STUFEN.length));
    }

    /* Der Typ-Split. UC.makeTypeChart ist derselbe Baustein, den das Combo-Chart und das
       Topcitations-Dashboard benutzen -- Doughnut, Balken, Legende, Skelett und der Tooltip
       kommen von dort. Hier steht nur, WANN was gezeichnet wird.
       decimals: 1 wie im Combo (CLAUDE.md 2b: der Standard des Kits ist 2 und fuer keinen Chart
       der App richtig). */
    /* Das Tor fuer das Balkenwachstum. renderBars gibt seinen Starter hierher, hoeheAnimiert ruft
       ihn erst, wenn Hoehe und Einblenden durch sind -- so laufen die drei Bewegungen NACHEINANDER
       (Hoehe, Einblenden, Balken) statt uebereinander. Laeuft kein hoeheAnimiert (Erstaufbau, neue
       Daten), startet das Tor sofort von selbst. */
    var wachsTor = { starter: null, offen: true };
    function torSchliessen() { wachsTor.starter = null; wachsTor.offen = false; }
    function torOeffnen() {
      wachsTor.offen = true;
      var s = wachsTor.starter; wachsTor.starter = null;
      if (s) s();
    }
    function torNehmen(starter) {
      if (wachsTor.offen) { starter(); return; }
      wachsTor.starter = starter;
    }

    var typeChart = UC.makeTypeChart ? UC.makeTypeChart({
      decimals: 1,
      growGate: torNehmen,
      body: elTypeBody,
      isDark: darkNow,
      isOwner: function () { return true; },
      /* "url" ist der Datenmodus: die Typen kommen aus URL_LABEL und der URL-Farbskala, nicht aus
         der Zitationstyp-Skala. Genau wie im Combo, wenn dort auf URL-Typen umgeschaltet ist. */
      mode: function () { return "url"; },
      chartMode: function () { return state.chartMode; },
      /* Die Zahl in der Mitte ist die Menge der zitierten Seiten dieser Domain -- sie steht im
         Trichter (cited_urls_count) und nicht in types_breakdown, das nur Anteile kennt. */
      total: function () { return state.funnel ? num(state.funnel.cited_urls_count) : null; },
      centerLabel: "Pages",
      collapseHost: root.querySelector(".udd-typecard")
    }) : null;

    function renderTypes() {
      if (!typeChart) return;
      if (state.error) { elTypeBody.innerHTML = '<div class="up-chart-empty">' + esc(state.error) + "</div>"; return; }
      if (istLaden() || !isArr(state.types)) { typeChart.skeleton(); return; }
      var vorbereitet = UC.prepTypeData("url", state.types, isDark);
      if (!vorbereitet.length) { typeChart.empty("No URL types for this period."); return; }
      if (state.chartMode === "bar") typeChart.renderBars(vorbereitet);
      else typeChart.renderDonut(vorbereitet);
    }

    /* Die Hoehe der ZEILE animieren, wenn ein Chart darin den Modus wechselt. Nicht die der
       einzelnen Karte: die Zeile richtet mit align-items: stretch aus, also folgt jede Karte der
       hoeheren -- gemessen blieb eine einzelne Karte bei 326px, egal was in ihr passierte, auch
       ohne min-height. Was sich aendert, ist die Zeile. transition auf height greift bei
       auto nicht -- also: aktuelle Hoehe festschreiben, neu zeichnen, Zielhoehe messen, darauf
       animieren und danach wieder freigeben. 200ms ease (Vorgabe).
       Ohne das Freigeben am Ende bliebe die Karte auf der gemessenen Hoehe stehen und wuerde beim
       naechsten Datenwechsel nicht mehr mitwachsen. */
    /* Der Wechsel Ring <-> Balken in DREI Schritten hintereinander, nicht uebereinander:
         1. die Hoehe der Karte animiert (200ms ease)
         2. mit demselben Mass danach der Inhalt eingeblendet (200ms ease)
         3. erst dann laufen die Erscheinungs-Animationen des Charts los (das Balkenwachstum)
       Vorher liefen 1 und 3 gleichzeitig, und fitBars() in core mass die Hoehe, waehrend sie noch
       die alte war -- es blendete Zeilen aus, die einen Frame spaeter Platz hatten, und der Umbruch
       passierte zweimal. Das war das Stocken.

       Die Zielhoehe wird NACH dem Einrichten des Charts gemessen: Chart.js richtet seine Leinwand
       ueber einen ResizeObserver ein, also erst nach diesem Lauf. Wer vorher misst, misst eine
       Hoehe, die es gleich nicht mehr gibt.

       Waehrend gemessen wird, haelt MIN-HEIGHT die alte Hoehe und nicht height: eine feste Hoehe
       quetscht die Balkenliste, und was nicht hineinpasst, ist weg (gemessen neun Balken im
       Dokument, fuenf sichtbar). Ein Mindestmass laesst wachsen und verhindert nur das
       Zusammenfallen. */
    var HANIM_MS = 200;
    function hoeheAnimiert(karte, neuZeichnen) {
      if (!karte || !karte.getBoundingClientRect) { neuZeichnen(); return; }
      var koerper = karte.querySelector(".udd-typebody, .udd-modelbody");
      var vorher = karte.getBoundingClientRect().height;
      karte.classList.add("is-hanim");
      karte.style.transition = "none";
      karte.style.minHeight = vorher + "px";
      /* Der Inhalt geht auf 0, OHNE Uebergang -- der Wechsel selbst soll nicht zu sehen sein, nur
         das Einblenden danach. */
      if (koerper) { koerper.style.transition = "none"; koerper.style.opacity = "0"; }
      torSchliessen();
      neuZeichnen();

      function einblenden() {
        if (!koerper) { torOeffnen(); aufraeumen(); return; }
        koerper.style.transition = "opacity " + HANIM_MS + "ms ease";
        koerper.style.opacity = "1";
        setTimeout(function () {
          koerper.style.transition = ""; koerper.style.opacity = "";
          /* Jetzt erst die Balken. */
          torOeffnen();
          aufraeumen();
        }, HANIM_MS + 20);
      }
      function aufraeumen() {
        karte.style.height = ""; karte.style.minHeight = ""; karte.style.transition = "";
        karte.classList.remove("is-hanim");
      }

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          /* Mindestmass loslassen, natuerliche Hoehe lesen, im selben Frame wieder festnageln --
             dazwischen entsteht kein Bild. */
          karte.style.minHeight = "";
          var nachher = karte.getBoundingClientRect().height;
          if (Math.abs(nachher - vorher) < 1) { einblenden(); return; }
          karte.style.height = vorher + "px";
          /* Den Startwert festschreiben, ohne zu zeichnen: ohne diese erzwungene Neuberechnung
             springt die Karte ohne Animation auf das Ziel. */
          void karte.offsetHeight;
          karte.style.transition = "height " + HANIM_MS + "ms ease";
          karte.style.height = nachher + "px";
          setTimeout(function () {
            karte.style.height = ""; karte.style.minHeight = ""; karte.style.transition = "";
            einblenden();
          }, HANIM_MS + 20);
        });
      });
    }

    function syncTypeSeg() {
      if (!elTypeSeg) return;
      [].forEach.call(elTypeSeg.querySelectorAll("[data-chart]"), function (b) {
        var an = b.getAttribute("data-chart") === state.chartMode;
        b.classList.toggle("is-active", an);
        b.setAttribute("aria-selected", an ? "true" : "false");
      });
    }

    /* Der Doughnut der Modelle. Dasselbe Werkzeug wie beim Typ-Split, nur mit selbst gebauten
       Items: die Modelle bringen ihre Farbe je Thema mit, es gibt fuer sie keine Skala in core.
       prepTypeData waere hier falsch -- das kennt nur Zitations- und URL-Typen. */
    var modelDonut = UC.makeTypeChart ? UC.makeTypeChart({
      growGate: torNehmen,
      decimals: 1,
      body: elModelDonut,
      isDark: darkNow,
      isOwner: function () { return true; },
      mode: function () { return "url"; },
      /* Derselbe Baustein zeichnet jetzt BEIDE Modi des Model Breakdowns. Vorher kamen die Balken
         aus UC.makeBarList -- die animiert anders (Breite und Text in einem Zug), waehrend
         makeTypeChart erst den Balken wachsen laesst und dann die Texte einfaedt. Zwei Charts in
         einer Zeile mit zwei Bewegungen liest sich als Fehler. Die Logos gehen dabei nicht
         verloren: renderBars in core kann sie jetzt auch. */
      chartMode: function () { return state.modelMode; },
      /* Die Zahl in der Mitte: wie viele verschiedene Modelle diese Domain ueberhaupt zitieren.
         Das ist die Laenge von model_breakdown selbst -- jeder Eintrag IST ein Modell. Keine
         Summe der Anteile, die waere immer 100. */
      total: function () { return isArr(state.model) ? state.model.length : null; },
      centerLabel: "Models",
      collapseHost: root.querySelector(".udd-modelcard")
    }) : null;

    function modelItems() {
      return (isArr(state.model) ? state.model : []).map(function (m) {
        return {
          key: String(m.model || ""),
          name: String(m.model || ""),
          share: num(m.model_share_pct) || 0,
          color: (isDark ? m.color_darkmode : m.color_lightmode) || typFarbe(),
          logo: String(m.model_logo_url || "")
        };
      });
    }

    function syncModelSeg() {
      if (!elModelSeg) return;
      [].forEach.call(elModelSeg.querySelectorAll("[data-mchart]"), function (b) {
        var an = b.getAttribute("data-mchart") === state.modelMode;
        b.classList.toggle("is-active", an);
        b.setAttribute("aria-selected", an ? "true" : "false");
      });
      root.classList.toggle("is-modeldonut", state.modelMode === "doughnut");
    }

    function renderBars() {
      if (!modelDonut) return;
      if (state.error) { modelDonut.empty(state.error); return; }
      if (istLaden() || !isArr(state.model)) { modelDonut.skeleton(); return; }
      var mi = modelItems();
      if (!mi.length) { modelDonut.empty("No model data for this period."); return; }
      if (state.modelMode === "bar") modelDonut.renderBars(mi);
      else modelDonut.renderDonut(mi);
    }

    function render() {
      syncSeg();
      syncTypeSeg();
      syncModelSeg();
      renderKpi();
      renderChart();
      renderFunnel();
      renderTypes();
      renderBars();
    }

    /* ---- Granularitaet: was die Daten hergeben ----------------------------------------------- */
    /* Die Granularitaet sagt der PAYLOAD, nicht der Schalter. Vorher wurde sie allein aus den
       Abstaenden zwischen den Punkten erraten -- kamen Wochendaten, zeigte der Schalter weiter
       "Day", obwohl das Chart schon Wochen zeichnete.
       BEIDE Setter lesen sie: der grosse Payload (setDomainDetail) traegt sie fuer die
       Zitationskurve, der URL-Payload (setDomainDetailUrls) fuer die URL-Kurve. Nur einen von
       beiden zu bedienen war genau der gemeldete Fehler.
       Nur die drei bekannten Werte werden uebernommen: ein Tippfehler in der RPC soll den Schalter
       nicht auf etwas stellen, das es nicht gibt. */
    function granAusPayload(p) {
      var g = String((p && p.granularity) || "").trim().toLowerCase();
      if (g !== "day" && g !== "week" && g !== "month") return false;
      if (g === state.gran) return false;
      state.gran = g; GRAN_STORE[instanceId] = g;
      return true;
    }
    function granPruefen() {
      if (!UC.granAvailability) return;
      var reihe = state.mode === "citation"
        ? (isArr(state.share) ? state.share : [])
        : (state.urls && isArr(state.urls.points) ? state.urls.points : []);
      var neu = UC.granAvailability(root, reihe, state.gran);
      if (neu !== state.gran) {
        state.gran = neu; GRAN_STORE[instanceId] = neu;
        syncSeg();
        fire("data-gran-fn", "uddGran", { mode: state.mode, gran: neu, scope: state.scope });
      }
    }

    /* ---- Klicks ------------------------------------------------------------------------------ */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var m = e.target.closest("[data-mode]");
      if (m && elSeg.contains(m)) {
        var k = m.getAttribute("data-mode");
        if (k === state.mode) return;              /* schon da: kein Ereignis, kein Neuladen */
        state.mode = k; modusSchreiben(instanceId, k);
        /* Der Wechsel nach Domain Share fordert die URL-Serie an: ab hier wird gewartet. */
        if (k === "domain" && !state.urls) urlWarteStarten();
        syncSeg(); renderKpi(); renderChart();
        fire("data-mode-fn", "uddMode", { mode: k, gran: state.gran, scope: state.scope });
        return;
      }
      var mc = e.target.closest("[data-mchart]");
      if (mc && elModelSeg && elModelSeg.contains(mc)) {
        var mk = mc.getAttribute("data-mchart");
        if (mk === state.modelMode) return;
        state.modelMode = mk; MCHART_STORE[instanceId] = mk;
        syncModelSeg();
        /* Animiert wird die Karte selbst, nicht mehr eine feste Zeile um beide: die gibt es seit
           dem Bereichsmenue nicht mehr. Weil das Raster seine Karten streckt, misst die Karte die
           Hoehe ihrer Rasterzeile -- steht der Breakdown allein, ist es seine eigene. */
        hoeheAnimiert(root.querySelector(".udd-modelcard"), renderBars);
        /* Kein Ereignis nach Bubble: derselbe Datensatz, andere Darstellung. */
        return;
      }

      var c = e.target.closest("[data-chart]");
      if (c && elTypeSeg && elTypeSeg.contains(c)) {
        var ck = c.getAttribute("data-chart");
        if (ck === state.chartMode) return;
        state.chartMode = ck; CHART_STORE[instanceId] = ck;
        syncTypeSeg();
        hoeheAnimiert(root.querySelector(".udd-typecard"), renderTypes);
        /* Kein Ereignis nach Bubble: der Wechsel zeichnet dieselben Daten anders. */
        return;
      }

      var g = e.target.closest("[data-gran]");
      if (g && elGran.contains(g)) {
        var gk = g.getAttribute("data-gran");
        if (gk === state.gran) return;
        state.gran = gk; GRAN_STORE[instanceId] = gk;
        /* Nur im Domain-Share: dort haengt die x-Achse an der URL-Serie, und eine Tageskurve
           unter der Aufschrift "Month" ist falsch. Im Citation-Share bleibt die alte Kurve
           stehen, bis setDomainDetail die neue bringt -- dort ist sie nur veraltet, nicht falsch. */
        if (state.mode === "domain") { state.urlsStale = true; urlWarteStarten(); }
        syncSeg(); renderChart();
        fire("data-gran-fn", "uddGran", { mode: state.mode, gran: gk, scope: state.scope });
        return;
      }
    });

    /* ---- Thema ------------------------------------------------------------------------------- */
    if (UC.onTheme) UC.onTheme(function (dunkel) {
      isDark = !!dunkel;
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      /* Die Kurve zeichnet das Kit selbst neu (makeLine haengt an onTheme). Trichter, Balken und
         der Typ-Split tragen ihre Farben im Markup und muessen es hier tun. */
      renderTypes();
      renderFunnel(); renderBars();
    });

    /* Die Beschriftungsspalte der Balken haengt an der Breite der EIGENEN Box. */
    if (window.ResizeObserver) {
      var letzteSchmal = root.classList.contains("is-narrow");
      new ResizeObserver(function () {
        var schmal = root.classList.contains("is-narrow");
        if (schmal !== letzteSchmal) { letzteSchmal = schmal; renderBars(); }
      }).observe(root);
    }

    var ctrl = {
      setData: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "domain-detail") : payload;
        /* Ein Payload, den parseLoose nicht lesen konnte, darf nicht stillschweigend verpuffen:
           sonst laeuft das Skelett endlos und sieht aus wie "gleich da". */
        var ok = p && typeof p === "object" && !isArr(p);
        if (!ok) {
          state.error = "The domain data could not be read.";
          state.hasData = false; state.loading = false;
          warteBeenden(); render(); return;
        }
        state.error = null;
        if (p.header && typeof p.header === "object") state.header = p.header;
        var ts = p.timeseries && typeof p.timeseries === "object" ? p.timeseries : {};
        if (isArr(ts.citation_share_over_time)) state.share = ts.citation_share_over_time;
        if (isArr(p.model_breakdown)) state.model = p.model_breakdown;
        if (p.source_presence_funnel && typeof p.source_presence_funnel === "object") {
          state.funnel = p.source_presence_funnel;
        }
        /* types_breakdown ist neu im Payload. Fehlt es, bleibt state.types null und der Abschnitt
           zeigt sein Skelett -- nicht "keine Typen", denn das waere eine Aussage ueber Daten, die
           gar nicht geschickt wurden. */
        if (isArr(p.types_breakdown)) state.types = p.types_breakdown;
        state.hasData = !!(state.header || state.share || state.model || state.funnel || state.types);
        /* Lesbar, aber ohne einen einzigen brauchbaren Block -- etwa "{}" aus einem Workflow, der
           nichts gefunden hat. Das ist KEIN Ladezustand: ohne diese Zeile blieben alle Abschnitte
           im Skelett stehen, optisch nicht von "gleich da" zu unterscheiden, obwohl die Antwort
           laengst da und leer ist. Genau der stille Ausfall, den §2 verbietet. */
        if (!state.hasData) state.error = "No data for this domain.";
        state.loading = false;
        warteBeenden();
        /* VOR granPruefen: der Wert aus dem Payload ist die Wahrheit, granPruefen korrigiert
           danach nur noch, falls die Spanne diese Stufe gar nicht zulaesst. */
        granAusPayload(p);
        granPruefen();
        render();
        return true;
      },
      setUrls: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "domain-detail urls") : payload;
        if (!p || typeof p !== "object" || !isArr(p.points)) {
          /* Die URL-Serie ist der zweite Aufruf und darf den ersten nicht mitreissen: ein
             unlesbarer Payload beendet nur den Wartezustand DIESES Charts. */
          state.urls = { points: [] };
        } else {
          state.urls = p;
          granAusPayload(p);
        }
        state.loading = false;
        state.urlsStale = false; state.urlsError = null;
        warteBeenden(); urlWarteBeenden();
        if (state.mode === "domain") granPruefen();
        syncSeg(); renderChart();
        return true;
      },
      setLoading: function (v) {
        state.loading = isYes(v);
        /* Loading = yes heisst: KEINE Daten zeigen -- nicht "die alten stehen lassen und ein
           Skelett darueberlegen". Der Unterschied ist nicht theoretisch: gemeldet wurde, dass beim
           Laden einer neuen Domain hier und da die Linie der VORIGEN erschien. Solange die alten
           Zahlen im Zustand liegen, kann jeder Weg, der spaeter neu zeichnet, sie wieder auf den
           Schirm bringen -- eine verzoegerte Zeichnung, ein Themenwechsel, ein Breitenwechsel.
           Weggeworfen kann das keiner mehr. Den Rest bringt der naechste setDomainDetail.
           Folge, die genannt sein muss: setzt ein Workflow loading=yes und danach loading=no OHNE
           neue Daten zu schicken, steht "No data" da und nicht mehr der alte Stand. Das ist die
           Regel, um die es hier geht. */
        if (state.loading) {
          state.header = null; state.share = null; state.urls = null;
          state.model = null; state.funnel = null; state.types = null;
          state.hasData = false; state.error = null;
          state.urlsStale = false; state.urlsError = null;
          warteStarten();
        } else warteBeenden();
        render();
        return true;
      },
      /* Reset raeumt DATEN weg, keine Einstellungen. Die Trennung ist der ganze Punkt:
           geleert   Kopf, Zeitreihen, Modelle, Typen, Trichter, URL-Serie, Fehlerzustaende
           auf day   die Granularitaet -- sie gehoert zu den Daten, nicht zur Ansicht: die neuen
                     Daten bringen ihre eigene mit (granularity im Payload), und bis dahin ist
                     "day" die einzige Stufe, die immer erlaubt ist
           BLEIBT    Citation Share / URL Share, und die Ring/Balken-Wahl der beiden Charts
         Vorher setzte reset() auch den Modus auf "citation" zurueck. Das ist eine Ansichtsvorliebe
         des Nutzers, und ein Datenwechsel ist kein Grund, sie ihm wegzunehmen.
         Danach steht die Komponente auf loading: das Skelett laeuft, die Warte-Uhr auch, und der
         naechste setDomainDetail beendet beides. */
      reset: function () {
        state.header = null; state.share = null; state.urls = null;
        state.model = null; state.funnel = null; state.types = null;
        state.hasData = false; state.error = null;
        state.urlsStale = false; state.urlsError = null; urlWarteBeenden();
        state.gran = "day"; GRAN_STORE[instanceId] = "day";
        state.scope = SCOPE_FEST;
        state.loading = true;
        warteStarten();
        render();
        /* Der Modus bleibt, wie der Nutzer ihn gestellt hat -- steht er auf URL Share, sind die
           URL-Daten aber gerade mit geleert worden, und der Klick, der sie sonst anfordert, kommt
           nach einem Reset nie. Also hier anfordern, wortgleich zum Klick. NACH render(), damit
           das Skelett schon steht, wenn der Workflow anlaeuft. */
        if (state.mode === "domain") {
          urlWarteStarten();
          fire("data-mode-fn", "uddMode", { mode: state.mode, gran: state.gran, scope: state.scope });
        }
        return true;
      },
      destroy: function () { warteBeenden(); try { line.destroy && line.destroy(); } catch (e) {} }
    };

    root.__uddController = ctrl;
    if (spaet) spaet.drain(instanceId, ctrl);

    /* Bubble fuellt dynamische Attribute manchmal erst NACH diesem Lauf -- der Markenname in der
       vierten Trichterstufe kommt von dort. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var b = (root.getAttribute("data-brand") || "").trim();
        if (b === "BRAND_NAME") b = "";
        if (b && b !== state.brand) { state.brand = b; renderFunnel(); }
        var d = UC.themeParam(root.getAttribute("data-isdark"));
        if (d !== isDark) { isDark = d; renderFunnel(); renderBars(); }
      }).observe(root, { attributes: true, attributeFilter: ["data-brand", "data-isdark", "data-theme"] });
    }


    render();
    return ctrl;
  }

  /* Wartet ein Aufruf auf eine Instanz, die es gerade nicht gibt, geht er NICHT verloren --
     siehe UC.makeLate. Bubble baut das Element zwischen zwei Durchlaeufen neu, und der Workflow
     feuert genau in dieses Fenster. */
  var spaet = UC.makeLate ? UC.makeLate("domain-detail", ".udd-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "udd-root", notPortal: true,
    ctrlProp: "__uddController",
    resolveLocal: "__uddResolveLocal",
    queue: "__uddBootQueue",
    initRoot: initRoot,
    api: {
      setDomainDetail:        function (id, p) { return each(id, function (c) { c.setData(p); }); },
      setDomainDetailUrls:    function (id, p) { return each(id, function (c) { c.setUrls(p); }); },
      setDomainDetailLoading: function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetDomainDetail:      function (id)    { return each(id, function (c) { c.reset(); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, fn);
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  if (UC.watchRoots) UC.watchRoots("udd-root", function () {
    [].forEach.call(document.querySelectorAll(".udd-root"), initRoot);
  });
  }

  uddBoot(30);
})();
