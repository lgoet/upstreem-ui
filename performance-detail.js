/* upstreem performance-detail.js — component logic. Requires core.js (window.UpstreemCore) first.

   Der Detailbereich unter dem Performance Radar. Er zeigt EINE Brand-x-Topic-Kombination:
   Kopfzeile, KPIs, das Standing der Marke auf diesem Topic, eine Visibility-Kurve und die
   Variations (die Namen, unter denen die Marke in den Antworten tatsaechlich vorkommt).

   Warum eigenes Element und nicht im Radar: die URLs-Table unter diesem Block ist eine eigene
   Komponente mit eigenem Loader und eigenem Render-Vertrag. Der Detailbereich ist also ohnehin aus
   mehreren Bubble-Elementen zusammengesetzt; dann ist es sauberer, wenn der Radar ein Chart bleibt
   und dieser Block sein eigenes Element ist. Er ist dadurch auch woanders verwendbar.

   Was NICHT hier nachgebaut wird (kommt alles aus core):
     Linien-Chart samt Tooltip, Skeleton, Groessen-Poll   UC.makeLine
     Serien -> Datasets                                  UC.buildLineDatasets
     Button-Tooltips                                     UC.makeTooltips
     Zellen-Primitive (Zahl, Sentiment, Rank, Trend)     UC.trendChip / UC.sentColor / UC.fmt1
     Bubble-Klempnerei (Registry, Stub-Replay, Forwarder) UC.makeMount
     Tabellenrahmen                                      .up-table / .up-thead / .up-row / .up-th / .up-td

   Der erste Aufbau braucht KEINEN Server: der Radar ruft renderPerformanceDetail() direkt mit den
   Daten der geklickten Zelle und den beiden Schnitten des Rasters (Spalte = Wettbewerber auf dem
   Topic, Zeile = diese Marke ueber alle Topics). Kopf, KPIs und Standing stehen damit sofort. Nur
   Kurve, Variations und die URLs-Table darunter kommen ueber RPCs nach.

   AUFBAU SEIT DEM 07.10. (angefordert: "die Designsprache und Layouts der neuen Komponenten und
   ihrer Detailbereiche"). Vorbilder und woher jeder Wert kommt:
     Kopf          ads.js zeichneHeld (.uad-held): Logo 44, Name in der Stufe 2xl, darunter eine
                   leise Zeile -- hier Topic-Chip und der Satz zum Rang
     Kennzahlen    UC.kpiKarte im offenen Kennzahlen-Band (.up-kpiband.is-4.is-offen), Werte zaehlen
                   hoch (UC.zaehlHtml/hochzaehlen) wie in Events und Shopping
     Abschnitte    .up-sec-head mit Titel und Untertitel, Inhalt im .up-box; 24 zwischen Kopf,
                   Kennzahlen und Kurve (eine Gruppe), 48 zwischen den Abschnitten (.ush-seite/.ush-gruppe)
     Rangliste     die Marktbewegung im Event-Detail: .up-vartable, Logo und Name, Zahlenspalten
                   140 breit, blaettert mit dem Pager aus core statt zu scrollen
     Variations    UC.variationsSection wie bisher, jetzt ebenfalls mit Seiten statt Scrollen
   Die Karte mit Rahmen um alles ist weg: die neuen Detailbereiche stehen offen auf der Seite. */
(function(){
  "use strict";

  /* Stubs, bevor irgendetwas auf core.js warten kann: Bubble pollt diese Namen und wuerde die
     fruehesten Aufrufe sonst verlieren. Gleiche Begruendung wie in jeder anderen Komponente. */
  var __updBootQueue = window.__updBootQueue = window.__updBootQueue || [];
  if (!window.__updBootStubbed){
    window.__updBootStubbed = true;
    ["renderPerformanceDetail", "setPerformanceDetailVariations", "setPerformanceDetailSeries",
     "setPerformanceDetailGlobal", "setPerformanceDetailLoading", "resetPerformanceDetail",
     "setPerformanceDetailTheme"].forEach(function(n){
      window[n] = function(){ __updBootQueue.push([n, arguments]); };
    });
  }

  function updBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ updBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[performance-detail] UpstreemCore (core.js) not loaded");
      return;
    }
    updRun();
  }

  function updRun(){
  var UC = window.UpstreemCore;

  /* Eine Seite teilt sich EIN core.js, und es gewinnt das zuletzt geladene. Steht darauf ein
     aelterer Pin als auf dieser Datei, fehlen Kits — und die Komponente starb frueher mit einem
     nackten "UC.x is not a function", das die Ursache nicht nennt. Einmal benennen, dann
     abstufen: ohne makeLine bleibt die Kurve leer, alles andere funktioniert weiter. */
  var MISSING = ["makeMount", "makeLine", "buildLineDatasets", "makeTooltips", "makeExplain", "makeFire", "trendChip",
                 "sentHtml", "esc", "fmt1"]
    .filter(function(k){ return typeof UC[k] !== "function"; });
  if (MISSING.length && window.console){
    console.error("[performance-detail] The core.js on this page is OLDER than performance-detail.js " +
      "and is missing: " + MISSING.join(", ") + ". Every Upstreem component on a page shares one " +
      "core.js (the last one loaded wins), so pin them ALL to the same commit (data-cdn-pin).");
  }
  if (typeof UC.makeLine !== "function"){
    UC.makeLine = function(){ return { render:function(){}, skeleton:function(){}, empty:function(){},
                                       destroy:function(){}, resize:function(){} }; };
  }
  if (typeof UC.buildLineDatasets !== "function"){
    UC.buildLineDatasets = function(){ return { labels: [], datasets: [] }; };
  }

  var esc = UC.esc, fmt1 = UC.fmt1, toNum = UC.toNum;
  var t = UC.t || function(x){ return x; };
  function ersetze(s, o){ return String(s).replace(/\{(\w+)\}/g, function(_, k){ return o[k] != null ? o[k] : ""; }); }
  /* Trefferhervorhebung aus dem Core -- dieselbe <mark class="up-hl">-Markierung, die die
     Tabellen in ihren Suchergebnissen setzen. */
  var highlight = UC.highlight || function(t){ return esc(t); };
  var HASH_SVG = UC.HASH_ICON ? UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ') : "";

  /* Formatierung nach STYLEGUIDE 1c: Prozente ohne Nachkommastelle, wenn sie ganz sind. */
  /* absolut=true fuer einen echten Sichtbarkeitswert, false/weggelassen fuer eine DIFFERENZ.
     Der Unterschied ist keine Kosmetik: bei v = 0.03 zeigte die Radar-Zelle "<1%" und die Kachel
     daneben "0%" -- dieselbe Zahl, zwei Aussagen, auf einem Bildschirm. Bei einem absoluten Wert
     ist die gerundete 0 eine Luege ("die Marke kommt nicht vor"), bei einer Differenz dagegen
     richtig: "0% behind" heisst gleichauf, "<1% behind" waere Unsinn. */
  function fmtPctShort(v, absolut){
    if (v == null || isNaN(v)) return "-";
    var n = Number(v);
    if (absolut && n > 0 && Math.round(n) === 0) return "<1%";
    return (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : fmt1(n)) + "%";
  }
  function num(v){ var n = toNum ? toNum(v) : (v == null ? null : Number(v)); return (n == null || isNaN(n)) ? null : n; }
  function avg(list){
    var vals = list.filter(function(v){ return v != null && !isNaN(v); });
    if (!vals.length) return null;
    return vals.reduce(function(a, b){ return a + b; }, 0) / vals.length;
  }

  var CLOSE_SVG  = UC.icon("x", 2);

  /* Das Logo-Kaestchen aus core (.up-logo-box), wie in der Marktbewegung des Event-Details und im
     Kopf der Ads -- vorher der Chip des Marken-Stapels (.up-stack-item), der fuer ueberlappende
     Logos gebaut ist und hier drei Regeln brauchte, um NICHT wie ein Stapel auszusehen. Der
     Anfangsbuchstabe steht darunter und bleibt, wenn das Bild nicht laedt. */
  function logoHtml(company, cls){
    var name = String((company && company.name) || "");
    var logo = String((company && (company.favicon_url || company.favicon || company.logo_url || company.logo)) || "");
    if (logo.indexOf("//") === 0) logo = "https:" + logo;
    return '<span class="up-logo-box' + (cls ? " " + cls : "") + (logo ? " has-img" : "") + '">' +
             /* KEIN loading="lazy": dieser Block oeffnet sich unter dem Falz, und lazy heisst
                dort "erst laden, wenn jemand hinscrollt" -- die Kacheln blieben leer, obwohl
                die URLs korrekt waren. Eine Seite der Rangliste traegt hoechstens 50 Bilder. */
             (logo ? '<img src="' + esc(logo) + '" alt="" referrerpolicy="no-referrer"' +
                     ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()">' : "") +
             '<span class="up-logo-ltr">' + esc(name.trim().charAt(0).toUpperCase() || "?") + '</span>' +
           '</span>';
  }
  /* Abschnittskopf aus core (.up-sec-head), wortgleich wie in Events, Shopping und Ads. */
  function sekKopf(titel, desc, rechts){
    return '<div class="up-sec-head upd-sec-head"><div class="up-sec-titles">' +
        '<span class="up-heading up-sec-h">' + esc(t(titel)) + '</span>' +
        (desc ? '<span class="up-sec-sub">' + esc(t(desc)) + '</span>' : '') +
      '</div>' + (rechts || '') + '</div>';
  }
  /* Topic-Chip in derselben Form wie im Radar und in der Prompts-Table. */
  function topicChipHtml(topic){
    if (!topic) return "";
    var hex = topic.color || topic.hex || "#6b7280";
    return '<span class="up-topicchip is-static" style="--ust-tag-color:' + esc(hex) + '">' +
      (topic.emoji ? '<span class="up-topicchip-e">' + esc(topic.emoji) + '</span>' : "") +
      '<span class="up-topicchip-lbl">' + esc(topic.name == null ? "" : topic.name) + '</span>' +
    '</span>';
  }

  /* Spalten-Erklaerer wie in jeder Tabelle: das kleine "i" im Kopf, das den dunklen Kasten
     oeffnet. Die Texte beantworten, was die Spalte MEINT -- nicht, wie sie heisst. */
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16V12"/><path d="M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z"/></svg>';
  function thInfo(key){ return '<span class="up-th-info" data-explain="' + key + '">' + INFO_SVG + '</span>'; }
  /* Die Erklaertexte kommen aus core -- dieselben, die brand-detail zeigt. Sonst erklaert
     dieselbe Spalte an zwei Orten Verschiedenes. */
  var VAR_EXPLAIN = UC.variationsExplain("on this topic");

  /* ---- EIN NEU GEBAUTES ELEMENT MACHT WEITER (27.09. gemeldet) ----
     "Es ist gar nicht noetig, dass beim Theme-Wechsel was in den Loading-yes-State geht." Bubble
     baut das Element beim Themewechsel neu -- data-isdark ist in der Vorlage ein dynamischer Wert
     (IS_DARK). makeController baute fuer die frische Wurzel den leeren Rahmen: keine Auswahl, also
     "No cell selected", mitten in der offenen Detail-Gruppe und obwohl der Nutzer laengst eine
     Zelle gewaehlt hatte. Was danach noch kam (Variations oder Kurve eines laufenden
     Ladevorgangs), landete im Zwischenlager fuer "vor der Auswahl" und erschien nie: die Auswahl
     kommt nur mit dem Zellklick, und den gibt es nicht noch einmal.
     Dieselbe Antwort wie in responses-table und im Radar darueber: der Zustand liegt zusaetzlich
     am window, je data-instance, und eine neue Wurzel derselben Instanz faengt dort an, wo die
     alte aufgehoert hat -- Auswahl, Kennzahlen, Kurve, Variations, Suche, Ladezustand,
     Lesefehler. Nur ein echter Seitenreload leert ihn. */
  var STORE = (window.__updStore = window.__updStore || {});


  /* ============================================================================================
     Controller pro Root
     ============================================================================================ */
  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "upd_" + Math.random().toString(36).slice(2) + "_" + (+new Date());

    /* Neuaufbau (siehe STORE): beim gemerkten Stand anfangen statt bei null. Ohne Eintrag ist
       das hier der Rahmen wie bisher, "No cell selected". */
    var saved = STORE[instanceId] || {};
    /* Die beiden Kurven-Faecher werden KOPIERT: setSeries schreibt an Ort und Stelle hinein, und
       ein Fach, das sich zwei Controller teilen, aendert sich unter dem einen, ohne dass er
       neu zeichnet. */
    function serien(s){ s = s || {}; return { topic: s.topic || null, global: s.global || null }; }

    var state = {
      company: saved.company || null, topic: saved.topic || null, cell: saved.cell || null,
      column: Array.isArray(saved.column) ? saved.column : [],   // alle Marken auf DIESEM Topic, aus dem Raster des Radars
      row: Array.isArray(saved.row) ? saved.row : [],            // DIESE Marke ueber alle Topics, ebenfalls aus dem Raster
      scope: saved.scope === "global" ? "global" : "topic",      // "topic" | "global"
      series: serien(saved.series),
      globalKpis: saved.globalKpis || null,      // optional per Setter; sonst aus state.row gerechnet
      /* null = noch nichts geliefert, [] = geliefert und leer -- der Unterschied ueberlebt den
         Neuaufbau mit, darum Array.isArray und nicht ||. */
      variations: Array.isArray(saved.variations) ? saved.variations : null,
      varQuery: String(saved.varQuery || ""),
      loading: !!saved.loading, hasData: !!saved.hasData, isDark: false,
      leseFehler: !!saved.leseFehler
    };
    /* Zwischenlager fuer Daten, die vor der Auswahl eintreffen. Siehe setSelection(). */
    var gemerktVorab = saved.vorab || {};
    var VORAB = { variations: Array.isArray(gemerktVorab.variations) ? gemerktVorab.variations : null,
                  series: serien(gemerktVorab.series), globalKpis: gemerktVorab.globalKpis || null };
    /* Nach JEDER Aenderung am Zustand: Auswahl, nachgereichte Teile, Ladezustand, Reset, Suche,
       Scope. Das Zwischenlager gehoert mit dazu -- kam ein Teil vor der Auswahl, soll er auch nach
       einem Neuaufbau noch auf sie warten. */
    function persist(){
      STORE[instanceId] = {
        company: state.company, topic: state.topic, cell: state.cell,
        column: state.column, row: state.row, scope: state.scope,
        series: serien(state.series), globalKpis: state.globalKpis, variations: state.variations,
        varQuery: state.varQuery, loading: !!state.loading, hasData: !!state.hasData,
        leseFehler: !!state.leseFehler,
        vorab: { variations: VORAB.variations, series: serien(VORAB.series), globalKpis: VORAB.globalKpis }
      };
    }

    /* -------- Markup. Die Bubble-Datei traegt nur das Wurzel-Div; alles darunter baut die
       Komponente selbst. Es gibt hier keine Stellen, an denen der Nutzer etwas einsetzen soll,
       und ein von Hand eingefuegter Rahmen ist genau die Art Markup, die man beim naechsten
       Einbau halb vergisst. -------- */
    /* Die Fusszeile einer Tabelle: Zeilen je Seite links, Seiten rechts -- dasselbe Markup wie im
       Event-Detail, in Shopping und in Ads. Versteckt, bis es Zeilen gibt (seitenStand). */
    function fussHtml(){
      return '<div class="up-foot upd-foot" hidden>' +
          '<div class="up-pagesize"><span class="up-pagesize-lbl">' + esc(t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(t("Rows per page")) + '"></div></div>' +
          '<div class="up-pager"></div>' +
        '</div>';
    }
    root.innerHTML =
      /* Der Leerzustand aus core (UC.leerHtml), in einem Kasten wie jeder Leerzustand der neuen
         Detailbereiche. Die beiden Texte tauscht render() je nach Lage aus. */
      '<div class="up-box upd-empty">' +
        UC.leerHtml({ titel: "No cell selected", text: "Pick a cell in the Performance Radar to see the details for that brand and topic." }) +
      '</div>' +
      '<div class="upd-body">' +
        '<div class="upd-gruppe">' +
          /* Der Scope-Umschalter (This Topic | Global) ist vorerst raus. Er war schluessig, solange
             man nur auf die Kurve schaut -- die Rangliste darunter ist aber eine Aussage UEBER DIESES
             TOPIC ("Rang 6 von 10 auf diesem Topic"), und die gibt es global nicht.
             Nur das Bedienelement ist weg, nicht die Mechanik: state.scope, setPerformanceDetailSeries
             mit seinem scope-Feld, setPerformanceDetailGlobal und der updScope-Event stehen
             unveraendert. */
          '<div class="upd-held">' +
            '<span class="upd-held-logo"></span>' +
            '<div class="upd-held-text">' +
              '<h2 class="upd-held-name"></h2>' +
              '<div class="upd-held-meta"><span class="upd-topic"></span><span class="upd-satz"></span></div>' +
            '</div>' +
            '<button class="up-iconbtn upd-close" type="button" data-tip="Close details" aria-label="Close details">' + CLOSE_SVG + '</button>' +
          '</div>' +
          '<div class="up-kpiband is-4 is-offen upd-kpis"></div>' +
          '<section class="upd-sek upd-chartsec">' +
            sekKopf("Visibility over time", "How often the brand appeared in AI answers on this topic.") +
            '<div class="up-box upd-chartbox"><div class="up-line-wrap upd-linewrap"><canvas class="up-line-canvas"></canvas></div></div>' +
          '</section>' +
        '</div>' +
        /* Die Rangliste: Inhalt und Fusszeile getrennt, damit der Pager an seiner Fusszeile haengen
           bleibt und renderStanding nur den Inhalt neu schreibt (wie seitenAnlegen in events.js). */
        '<section class="upd-sek upd-rangsek" data-sek="rang">' +
          sekKopf("Brands on this topic", "Every tracked brand on this topic, ranked by visibility.") +
          '<div class="upd-tabinhalt"></div>' + fussHtml() +
        '</section>' +
        /* Der ganze Abschnitt kommt aus core (UC.variationsSection): Ueberschrift, Untertitel,
           Suchfeld, Tabellenkopf mit den drei Erklaer-Rauten. Genau derselbe Aufruf steht in
           brand-detail -- eine Tabelle, eine Quelle. Die Fusszeile kommt hier dazu. */
        UC.variationsSection({ prefix: "upd", scope: "on this topic" }) +
      '</div>';
    var elVarSek = root.querySelector(".upd-varsec");
    if (elVarSek){ elVarSek.setAttribute("data-sek", "var"); elVarSek.insertAdjacentHTML("beforeend", fussHtml()); }

    var elHeldLogo = root.querySelector(".upd-held-logo");
    var elHeldName = root.querySelector(".upd-held-name");
    var elTopic   = root.querySelector(".upd-topic");
    var elSatz    = root.querySelector(".upd-satz");
    var elKpis    = root.querySelector(".upd-kpis");
    var elStand   = root.querySelector('[data-sek="rang"] .upd-tabinhalt');
    var elRangSek = root.querySelector('[data-sek="rang"]');
    var elScope   = root.querySelector(".upd-scope");
    var elNote    = root.querySelector(".upd-scope-note");
    var lineWrap  = root.querySelector(".upd-linewrap");
    var lineCv    = root.querySelector(".up-line-canvas");
    var elVBody   = root.querySelector(".upd-vbody");
    var elSearch  = root.querySelector(".upd-search");
    var elSInput  = root.querySelector(".up-search-input");

    /* Drei Spalten, feste Anteile: der Name nimmt den Rest, die beiden Zahlenspalten sind so breit
       wie ihre Ueberschriften plus Luft. --up-cols ist die Variable, die .up-thead/.up-row lesen. */
    root.querySelector(".upd-vartable").style.setProperty("--up-cols", "minmax(0,1fr) 150px 140px");
    /* Umbruch nach Containerbreite, nicht nach Fensterbreite: die Komponente kann in einer
       schmalen Bubble-Gruppe stecken, waehrend das Fenster breit ist. Dieselben Schwellen wie im
       Event-Detail (760/520) -- an is-narrow haengt das Kennzahlen-Band aus core (2 x 2). */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 520 });

    /* ---- SEITEN STATT SCROLLEN (07.10., wie im Event-Detail: "gleiche Pagination wie in allen
       anderen Tabellen") -----------------------------------------------------------------------
       Beide Tabellen blaettern im Browser: die Rangliste ist die Spalte des Radars, die Variations
       kommen vollstaendig aus ihrem RPC -- es gibt nichts nachzuladen. Die Form ist wortgleich
       seitenAnlegen/seitenStand aus events.js. */
    var SEITEN_GROESSE = UC.DEFAULT_PAGE_SIZE || 15;
    var seiten = {};
    ["rang", "var"].forEach(function(n){
      var el = root.querySelector('[data-sek="' + n + '"]');
      if (!el) return;
      var st = { page: 1, pageSize: SEITEN_GROESSE, totalCount: null, loading: false };
      var neu = function(){ st.loading = false; if (n === "rang") renderStanding(); else renderVariations(); };
      seiten[n] = { st: st, kit: UC.makePager ? UC.makePager({ root: el, state: st, onChange: neu }) : null };
      /* Die Klicks der Fusszeile -- der Pager aus core zeichnet nur. */
      el.addEventListener("click", function(e){
        var k = seiten[n] && seiten[n].kit;
        if (!k || !e.target.closest || !e.target.closest(".upd-foot")) return;
        var ps = e.target.closest("[data-pagesize]");
        if (ps){ k.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev")){ k.goToPage(st.page - 1); return; }
        if (e.target.closest(".up-page-next")){ k.goToPage(st.page + 1); return; }
        var pg = e.target.closest(".up-page[data-page]");
        if (pg) k.goToPage(Number(pg.getAttribute("data-page")));
      });
    });
    /* Fusszeile zeichnen und den Ausschnitt der aktuellen Seite liefern. total null: keine
       Fusszeile (Skelett, Leerzustand). Sichtbar, sobald es Zeilen gibt -- auch bei einer Seite. */
    function seitenStand(n, total){
      var s = seiten[n], el = root.querySelector('[data-sek="' + n + '"]');
      var foot = el ? el.querySelector(".upd-foot") : null;
      if (foot) foot.hidden = !(total > 0);
      if (!s || !(total > 0)) return { von: 0, bis: total || 0 };
      s.st.totalCount = total; s.st.loading = false;
      var max = Math.max(1, Math.ceil(total / s.st.pageSize));
      if (s.st.page > max) s.st.page = max;
      if (s.kit){ try { s.kit.renderPageSize(); s.kit.renderPager(); } catch(e){} }
      var von = (s.st.page - 1) * s.st.pageSize;
      return { von: von, bis: von + s.st.pageSize };
    }

    function darkNow(){ return state.isDark; }
    function isOwner(){ return root.__updController && root.__updController.__ctrlId === myCtrlId; }

    var line = UC.makeLine({
      wrap: lineWrap, canvas: lineCv, legend: null,
      isDark: darkNow, isOwner: isOwner,
      /* Die Stufe der Kurve, die gerade zu sehen ist: ihr Feld granularity bzw. gran, sonst der
         Abstand der Punkte (UC.granAusLieferung, 01.10.). Hier stand fest "day" -- kam eine
         Wochenreihe, stand an der Achse und im Tooltip trotzdem ein Tagesdatum statt der Woche.
         Einen Schalter gibt es hier nicht; es geht nur um die Beschriftung. */
      gran: function(){
        var pl = state.series && state.series[state.scope];
        var g = (pl && UC.granAusLieferung) ? UC.granAusLieferung(pl, pl.series) : null;
        return g || "day";
      },
      /* "in jedem Linechart" -- auch hier. Die Kurve ist 260px hoch (.upd-chartsec .upd-linewrap),
         also in derselben Groessenordnung wie die anderen; das Zeichen sitzt nicht im Weg. */
      watermark: true
    });

    /* ---------------- KPIs ----------------
       Im Scope "This Topic" sind das exakt die Werte der geklickten Zelle. Im Scope "Global" der
       Schnitt dieser Marke ueber alle Topics des Rasters -- ausser Bubble hat ueber
       setPerformanceDetailGlobal() echte kontoweite Zahlen geliefert, die haben Vorrang. Der
       Unterschied steht im UI, damit niemand den Rasterschnitt fuer die kontoweite Zahl haelt. */
    function kpiSource(){
      if (state.scope === "topic") return { kpi: state.cell || {}, derived: false };
      if (state.globalKpis) return { kpi: state.globalKpis, derived: false };
      var r = state.row || [];
      return {
        derived: true,
        kpi: {
          visibility_pct:       avg(r.map(function(c){ return num(c.visibility_pct); })),
          visibility_delta_pct: avg(r.map(function(c){ return num(c.visibility_delta_pct); })),
          sentiment:            avg(r.map(function(c){ return num(c.sentiment); })),
          sentiment_delta:      avg(r.map(function(c){ return num(c.sentiment_delta); })),
          avg_rank:             avg(r.map(function(c){ return num(c.avg_rank); })),
          avg_rank_delta:       avg(r.map(function(c){ return num(c.avg_rank_delta); })),
          mentions:             r.reduce(function(a, c){ return a + (num(c.mentions) || 0); }, 0),
          mentions_prev:        r.reduce(function(a, c){ return a + (num(c.mentions_prev) || 0); }, 0)
        }
      };
    }
    /* Eine Kachel des Kennzahlen-Bands: UC.kpiKarte wie in Events, Shopping und Ads. */
    function kpiTile(label, valueHtml, trendHtml){
      return UC.kpiKarte({ label: label, wertHtml: valueHtml, trendHtml: trendHtml, klasse: "upd-kpi" });
    }
    /* Das kleine "i" an jedem Label oeffnet die Erklaerkarte (makeExplain unten) -- wie
       erklaerAnLabels in shopping.js. Vorher stand derselbe Satz als Tooltip auf der ganzen Kachel. */
    function erklaerAnLabels(el, keys){
      var l = el.querySelectorAll(".up-kpi-label");
      for (var i = 0; i < l.length && i < keys.length; i++){
        if (keys[i]) l[i].insertAdjacentHTML("beforeend",
          '<span class="up-th-info upd-erklaer" data-explain="' + keys[i] + '">' + UC.icon("info", 2) + '</span>');
      }
    }
    /* ---------------- Ladezustand fuer KPIs und Rangliste ----------------
       Bisher hing am Ladezustand nur die Kurve; KPIs und Rangliste wurden gedimmt und zeigten
       weiter die Zahlen der vorigen Zelle. Beim Zellwechsel stand damit ein Teil des Bereichs
       schon auf den neuen Daten, waehrend daneben noch die alten standen -- und alte Zahlen zu
       zeigen ist schlimmer als gar keine, weil man ihnen nicht ansieht, dass sie von gestern sind.
       Die Skelette kommen aus core (UC.kpiKarteSkelett, UC.skeletonRows) und haben die Form ihrer
       echten Geschwister. */
    var SK_ZEILEN = 5;

    /* Die Werte in den Kacheln zaehlen hoch wie in Events und Shopping -- dieselbe Form wie in den
       Zellen, nur mit den Zaehl-Markierungen aus core. Zellen zaehlen nicht. */
    function kpiWert(feld, v){
      if (v == null) return '<span class="up-num is-empty">–</span>';
      if (!UC.zaehlHtml) return zellWert(feld, v);
      if (feld === "sentiment") return UC.sentHtml(v, { zaehlen: true });
      if (feld === "rank") return '<span class="up-rank-group">' + HASH_SVG + UC.zaehlHtml(v, "num1") + '</span>';
      if (feld === "mentions") return UC.zaehlHtml(v, "int");
      return UC.zaehlHtml(v, "pct1");
    }
    /* Ein Wert in einer Zelle der Rangliste, nach CLAUDE.md 2b: Visibility mit einer Stelle und
       Prozentzeichen, Rang IMMER mit einer Stelle und der Raute, Sentiment als ganze Note mit dem
       Balken aus core, Mentions ganz. */
    function zellWert(feld, v){
      if (v == null) return '<span class="up-num is-empty">–</span>';
      if (feld === "sentiment") return UC.sentHtml(v);
      if (feld === "rank") return '<span class="up-rank-group">' + HASH_SVG + '<span class="up-num">' + fmt1(v) + '</span></span>';
      if (feld === "mentions") return '<span class="up-num">' + (UC.fmtInt ? UC.fmtInt(v) : Math.round(v)) + '</span>';
      return '<span class="up-num">' + (UC.fmtPct ? UC.fmtPct(v, 1) : fmt1(v) + "%") + '</span>';
    }

    function renderKpis(){
      if (state.loading){
        elKpis.innerHTML = [0, 1, 2, 3].map(function(){ return UC.kpiKarteSkelett ? UC.kpiKarteSkelett("upd-kpi") : ""; }).join("");
        return;
      }
      var src = kpiSource(), k = src.kpi;
      var ment = num(k.mentions), mentPrev = num(k.mentions_prev);
      var mentDelta = (ment != null && mentPrev != null) ? (ment - mentPrev) : null;
      var tc = UC.trendChip;
      elKpis.innerHTML =
        kpiTile("Visibility", kpiWert("visibility", num(k.visibility_pct)),
                tc ? tc(num(k.visibility_delta_pct), { decimals: true, suffix: "%" }) : "") +
        /* Rank ist invertiert: die kleinere Zahl ist die bessere, also ist ein negatives Delta gruen. */
        kpiTile("Avg. Rank", kpiWert("rank", num(k.avg_rank)),
                tc ? tc(num(k.avg_rank_delta), { decimals: true, inverted: true }) : "") +
        kpiTile("Sentiment", kpiWert("sentiment", num(k.sentiment)),
                tc ? tc(num(k.sentiment_delta), {}) : "") +
        kpiTile("Mentions", kpiWert("mentions", ment), tc ? tc(mentDelta, {}) : "");
      erklaerAnLabels(elKpis, ["kVis", "kRank", "kSent", "kMent"]);
      /* Je Kombination gemerkt: dieselbe Zelle noch einmal gezeichnet (Theme, Neuaufbau, Nachzuegler)
         zaehlt nicht von vorn, eine andere schon. */
      if (UC.hochzaehlen) UC.hochzaehlen(elKpis, "upd|" + instanceId + "|" + paarSchluessel(state.company, state.topic));

      /* Der Hinweis gehoert zum Scope-Umschalter und ist mit ihm raus. Die Zeile bleibt
         defensiv, damit ein wieder eingesetzter Umschalter sie sofort wieder fuellt. */
      if (elNote){
        elNote.textContent = state.scope === "global"
          ? (src.derived ? "Average across all topics in the radar" : "Across all tracked prompts")
          : "";
      }
    }

    /* ---------------- Standing auf diesem Topic ----------------
       Kostet keinen einzigen Serveraufruf: die Spalte des Rasters liegt schon vor. Zwei Teile: der
       Satz zum Rang steht im Kopf unter dem Namen (er ist DIE Aussage dieser Zelle), die ganze
       Rangliste als Tabelle darunter -- wie die Marktbewegung im Event-Detail. Vorher zeigte die
       Liste nur ein Fenster von sieben Marken um die eigene; mit Seiten kann sie vollstaendig sein,
       und die erste Seite ist die, auf der die gewaehlte Marke steht. */
    function spalteSortiert(){
      var col = (state.column || []).filter(function(c){ return c && num(c.visibility_pct) != null; });
      col.sort(function(a, b){ return num(b.visibility_pct) - num(a.visibility_pct); });
      return col;
    }
    function rangSatz(col){
      if (!state.company || col.length < 2) return "";
      var myId = String(state.company.company_id), myIdx = -1;
      for (var i = 0; i < col.length; i++) if (String(col[i].company_id) === myId){ myIdx = i; break; }
      if (myIdx < 0) return ersetze(t("Not among the {n} brands tracked on this topic"), { n: col.length });
      if (myIdx === 0){
        return ersetze(t("Leading this topic, {diff} ahead of #2 {name}"), {
          diff: fmtPctShort(num(col[0].visibility_pct) - num(col[1].visibility_pct)),
          name: String(col[1].name || "") });
      }
      /* Mit Rang davor: "behind Volvo" laesst offen, ob Volvo der Erste ist oder irgendwer
         dazwischen. */
      return ersetze(t("Rank {rank} of {n} on this topic, {diff} behind #1 {name}"), {
        rank: myIdx + 1, n: col.length,
        diff: fmtPctShort(num(col[0].visibility_pct) - num(col[myIdx].visibility_pct)),
        name: String(col[0].name || "") });
    }
    function rangKopf(){
      function th(txt, key){
        return '<div class="up-th upd-th-zahl">' + esc(t(txt)) +
          '<span class="up-th-info upd-erklaer" data-explain="' + key + '">' + UC.icon("info", 2) + '</span></div>';
      }
      return '<div class="up-thead up-vrow"><div class="up-th up-th-vname">' + esc(t("Brand")) + '</div>' +
        th("Visibility", "kVis") + th("Avg. Rank", "kRank") + th("Sentiment", "kSent") + th("Mentions", "kMent") + '</div>';
    }
    /* Die Seite der gewaehlten Marke: einmal je Kombination, danach blaettert der Nutzer selbst. */
    var rangSeiteFuer = null;
    function renderStanding(){
      if (state.loading){
        elRangSek.hidden = false;
        elSatz.innerHTML = '<span class="up-tsk-bar upd-satz-sk"></span>';
        elStand.innerHTML = '<div class="up-vartable upd-rang">' + rangKopf() + '<div class="up-tbody up-vbody">' +
          (UC.skeletonRows ? UC.skeletonRows({ count: SK_ZEILEN, rowClass: "up-row up-vrow", cellClass: "up-td",
            cols: [{ w: 110, jitter: 30, logo: true, cls: "up-var-name upd-td-marke" }, { w: 44, cls: "upd-td-zahl" },
                   { w: 36, cls: "upd-td-zahl" }, { w: 40, cls: "upd-td-zahl" }, { w: 32, cls: "upd-td-zahl" }] }) : "") +
          '</div></div>';
        seitenStand("rang", null);
        return;
      }
      var col = spalteSortiert();
      elSatz.textContent = state.scope === "topic" ? rangSatz(col) : "";
      /* Eine Rangliste mit nur einer Marke ist keine -- der Abschnitt faellt dann weg, wie die
         Marktbewegung ohne Wettbewerber (Spezifikation 85 der Events). */
      if (state.scope !== "topic" || !state.company || col.length < 2){
        elStand.innerHTML = "";
        seitenStand("rang", null);
        elRangSek.hidden = true;
        return;
      }
      elRangSek.hidden = false;
      var myId = String(state.company.company_id);
      var schluessel = paarSchluessel(state.company, state.topic);
      if (rangSeiteFuer !== schluessel && seiten.rang){
        rangSeiteFuer = schluessel;
        var myIdx = -1;
        for (var i = 0; i < col.length; i++) if (String(col[i].company_id) === myId){ myIdx = i; break; }
        seiten.rang.st.page = myIdx >= 0 ? Math.floor(myIdx / seiten.rang.st.pageSize) + 1 : 1;
      }
      var ab = seitenStand("rang", col.length);
      elStand.innerHTML = '<div class="up-vartable upd-rang">' + rangKopf() + '<div class="up-tbody up-vbody">' +
        col.slice(ab.von, ab.bis).map(function(c, j){
          var self = String(c.company_id) === myId;
          return '<div class="up-row up-vrow upd-rangzeile' + (self ? " is-self" : "") + '" role="button" tabindex="0"' +
                   ' data-cid="' + esc(String(c.company_id)) + '"' +
                   ' data-cname="' + esc(String(c.name || "")) + '">' +
                   '<div class="up-td up-var-name upd-td-marke">' +
                     '<span class="upd-platz">' + (ab.von + j + 1) + '</span>' + logoHtml(c) +
                     '<span class="up-varname">' + esc(String(c.name || "")) + '</span>' +
                   '</div>' +
                   '<div class="up-td upd-td-zahl">' + zellWert("visibility", num(c.visibility_pct)) + '</div>' +
                   '<div class="up-td upd-td-zahl">' + zellWert("rank", num(c.avg_rank)) + '</div>' +
                   '<div class="up-td upd-td-zahl">' + zellWert("sentiment", num(c.sentiment)) + '</div>' +
                   '<div class="up-td upd-td-zahl">' + zellWert("mentions", num(c.mentions)) + '</div>' +
                 '</div>';
        }).join("") + '</div></div>';
    }

    /* ---------------- Kurve ---------------- */
    function renderChart(){
      var payload = state.series[state.scope];
      if (state.loading || (!payload && state.hasData && !state.series.topic && !state.series.global)){
        line.skeleton(); return;
      }
      if (!payload || !payload.series || !payload.series.length){ line.empty(); return; }
      /* Der RPC liefert {day, value} und die company_id einmal obendrueber. buildLineDatasets
         erwartet die id an jedem Punkt und das Feld visibility_pct -- also einmal umlegen statt
         eine zweite Chart-Aufbereitung danebenzustellen. */
      var cid = payload.company_id != null ? payload.company_id
              : (state.company ? state.company.company_id : "series");
      var pts = payload.series.map(function(p){
        return { company_id: cid, day: p.day, visibility_pct: num(p.value) };
      });
      /* Linienfarbe: die Akzentfarbe als Tinte (19.09. angefordert, ausdruecklich auch fuer den
         Standard -- dort ist sie die Schriftfarbe des Themas). Hier stand der Farbwert einer
         Heatmap-Zelle bei 65 Prozent; die Begruendung dafuer war, dass die Kurve sichtbar zum
         Radar darueber gehoert. Das gilt weiter, nur folgt die Matrix jetzt selbst der
         Akzentfarbe -- beide kommen also nach wie vor aus einer Quelle. */
      var linie = UC.chartInk ? UC.chartInk(root) : UC.accentInk ? UC.accentInk(root) : "#1f1f1b";
      var comp = state.company ? [{
        company_id: cid, name: state.company.name, color: linie,
        favicon_url: state.company.favicon_url || state.company.logo_url || state.company.logo || ""
      }] : [];
      line.render(UC.buildLineDatasets(pts, comp, null));
    }

    /* ---------------- Variations ----------------
       Die Suche filtert lokal. UC.makeSearch ist fuer serverseitige Suche gebaut (Debounce,
       requestId, Loading-Flag) -- die Variations liegen vollstaendig im Speicher, ein Rundgang
       zum Server waere hier reine Latenz. Markup und Auf-/Zuklappen sind trotzdem das geteilte
       .up-search, damit das Feld aussieht und sich anfuehlt wie ueberall sonst. */
    /* Kleiner Ring statt Balken: ein Balken in einer Tabellenzelle laeuft ueber die ganze
       Spaltenbreite und macht die Zeile unruhig, ein Ring bleibt ein Zeichen neben der Zahl.
       Grauer Track, dunkler Bogen -- keine Farbe, weil Share of Voice keine Wertung ist.
       Der Bogen startet oben: die -90-Grad-Drehung steckt im SVG, nicht in einer CSS-Transform,
       damit er in beiden Themes und bei jeder Schriftgroesse gleich sitzt. */
    function varRows(){
      var list = state.variations || [];
      var q = state.varQuery.toLowerCase();
      if (!q) return list;
      return list.filter(function(v){ return String(v.name || "").toLowerCase().indexOf(q) !== -1; });
    }
    function renderVariations(){
      if (state.variations == null){
        /* Skelett aus DEMSELBEN Kit wie die Zeilen. Der eigene skeletonRows-Aufruf, der hier
           stand, gab allen drei Zellen nur .up-td -- ohne die Spaltenbreiten stand die
           Namensspalte zu breit und alles dahinter versetzt. */
        elVBody.innerHTML = UC.variationRows(null, { rowClass: "up-vrow upd-vrow" });
        seitenStand("var", null);
        return;
      }
      var rows = varRows();
      if (!rows.length){
        elVBody.innerHTML = '<div class="up-empty-mini">' +
          esc(t(state.varQuery ? "No variation matches this search." : "No variations recorded for this combination.")) +
          '</div>';
        seitenStand("var", null);
        return;
      }
      /* UC.variationRows baut die Zeilen -- dasselbe Kit, das brand-detail benutzt. Was hier
         frueher stand, war die Vorlage dafuer; sie ist wortgleich nach core gewandert. Seit dem
         07.10. nur die Zeilen der aktuellen Seite. */
      var ab = seitenStand("var", rows.length);
      elVBody.innerHTML = UC.variationRows(rows.slice(ab.von, ab.bis), { query: state.varQuery,
                                                   rowClass: "up-vrow upd-vrow" });
    }
    /* Eine neue Suche beginnt auf Seite 1 -- sonst stuende man nach dem Tippen auf einer Seite,
       die es fuer die kuerzere Liste nicht mehr gibt (seitenStand fiele zwar auf die letzte
       zurueck, aber die erste ist die, auf der die besten Treffer stehen). */
    function varSeiteZurueck(){ if (seiten["var"]) seiten["var"].st.page = 1; }

    /* ---------------- Gesamt-Render ---------------- */
    function render(){
      if (!isOwner()) return;
      syncTheme();
      var on = !!(state.company && state.topic);
      root.classList.toggle("has-selection", on);
      /* Der Leerkasten traegt zwei verschiedene Aussagen: "noch nichts gewaehlt" und "es kam
         etwas an, aber es war unlesbar". Ohne die zweite las sich ein zerrissener Payload als
         "Pick a cell", obwohl der Nutzer laengst eine gewaehlt hatte. */
      var elLeerT = root.querySelector(".upd-empty .up-empty-h");
      var elLeerS = root.querySelector(".upd-empty .up-empty-t");
      if (elLeerT && elLeerS){
        elLeerT.textContent = t(state.leseFehler ? "Could not load this cell" : "No cell selected");
        elLeerS.textContent = t(state.leseFehler
          ? "The data could not be read. Please reload the page."
          : "Pick a cell in the Performance Radar to see the details for that brand and topic.");
      }
      if (!on) return;
      elHeldLogo.innerHTML = logoHtml(state.company, "upd-held-logobox");
      elHeldName.textContent = String(state.company.name || "");
      elTopic.innerHTML = topicChipHtml(state.topic);
      renderKpis();
      renderStanding();
      renderChart();
      renderVariations();
    }

    function syncTheme(){
      var attr = root.getAttribute("data-theme");
      state.isDark = attr ? (attr === "dark") : !!(document.documentElement.getAttribute("data-theme") === "dark");
    }

    /* ---------------- Events an Bubble ----------------
       UC.makeFire nach STYLEGUIDE 13: EIN JSON-String als einziges Argument, Funktionssuche ueber
       iframe-Grenzen, console.warn bei fehlender Verdrahtung, zusaetzlich ein CustomEvent am Root.
       Es haengt ausserdem team_id vorne an, damit ein Workflow pruefen kann, ob die Antwort zum
       gerade sichtbaren Team gehoert. Selbst geschrieben war das dreimal weniger als das hier. */
    var fire = UC.makeFire
      ? UC.makeFire(root, { label: "performance-detail", eventPrefix: "upd-" })
      : function(){ };

    /* ---------------- Verdrahtung ----------------
       Der Scope-Umschalter ist aus dem Markup raus (siehe dort). Die Verdrahtung bleibt stehen
       und haengt sich nur an, wenn es ihn gibt -- so ist das Zurueckholen eine Markup-Aenderung
       und keine zweite Baustelle im JavaScript. */
    if (elScope) elScope.addEventListener("click", function(e){
      var btn = e.target.closest ? e.target.closest("[data-scope]") : null;
      if (!btn) return;
      var next = btn.getAttribute("data-scope");
      if (next === state.scope) return;
      state.scope = next;
      var all = elScope.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < all.length; i++) all[i].classList.toggle("is-active", all[i] === btn);
      render();
      persist();
      /* Die Kurve fuer den anderen Scope kann fehlen -- Bubble holt sie nach. Die KPIs stehen
         schon, weil sie aus dem Raster kommen. */
      if (!state.series[next] && state.company && state.topic){
        fire("data-scope-fn", "bubble_fn_updScope", {
          company_id: state.company.company_id, topic_id: state.topic.topic_id, scope: next
        });
      }
    });

    /* Klick auf eine Marke in der Rangliste. Uebergibt NUR die company_id als blanken Text --
       kein JSON, ausdrueckliche Vorgabe.

       Damit weicht dieser eine Event von STYLEGUIDE 13 ab (ein Event = EIN JSON-String). Der
       Praezedenzfall steht daneben: der Zellklick des Radars gibt seit jeher "companyId||topicId"
       als blanken Text. Der Preis ist, dass hier nichts mehr mitfahren kann -- weder team_id noch
       topic_id --, ein Workflow also aus seinen eigenen Custom States wissen muss, auf welchem
       Topic der Detailbereich gerade steht. Das ist der Fall, weil derselbe Workflow sie beim
       Zellklick ohnehin gesetzt hat.

       Nicht ueber UC.makeFire: das prependet team_id und macht JSON daraus, genau das soll hier
       nicht passieren. Stattdessen dieselbe Aufloesung wie beim Radar -- ueber alle erreichbaren
       Frames suchen, genau einmal warnen, wenn niemand zuhoert, und den DOM-Event als Rueckfall
       trotzdem mit dem vollen Objekt feuern. */
    function fireCompanyClick(row){
      var cid = row.getAttribute("data-cid") || "";
      var fnName = root.getAttribute("data-company-fn") || "bubble_fn_updCompanyClick";
      var fn = UC.resolveBubbleFn ? UC.resolveBubbleFn(fnName) : window[fnName];
      if (typeof fn === "function"){ try { fn(cid); } catch(e){} }
      else if (window.console){
        console.warn("[performance-detail] " + fnName + " not found on window/parent/top or any " +
          "reachable iframe — the row click reached no Bubble workflow. Check the Toolbox element's name.");
      }
      /* Der DOM-Event behaelt das volle Objekt: er ist nicht der Bubble-Vertrag, sondern der Weg
         fuer alles andere auf der Seite, und dort kostet mehr Information nichts. */
      try {
        root.dispatchEvent(new CustomEvent("updCompanyClick", { bubbles: true, detail: {
          company_id: cid,
          company_name: row.getAttribute("data-cname") || "",
          topic_id: state.topic ? state.topic.topic_id : ""
        }}));
      } catch(e){}
    }

    elStand.addEventListener("click", function(e){
      var row = e.target.closest ? e.target.closest(".upd-rangzeile") : null;
      if (!row) return;
      fireCompanyClick(row);
    });
    /* Tastatur: die Zeile ist ein Button, also muss sie auch auf Enter und Leertaste hoeren. */
    elStand.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest ? e.target.closest(".upd-rangzeile") : null;
      if (!row) return;
      e.preventDefault();
      row.click();
    });

    root.querySelector(".upd-close").addEventListener("click", function(){
      var had = !!(state.company && state.topic);
      var payload = had ? { company_id: state.company.company_id, topic_id: state.topic.topic_id } : {};
      reset();
      if (had) fire("data-close-fn", "bubble_fn_updClose", payload);
    });

    /* Suche: aufklappen, tippen, leeren. Kein Debounce noetig, die Liste liegt im Speicher. */
    root.querySelector(".up-search-btn").addEventListener("click", function(){
      var open = !elSearch.classList.contains("is-open");
      elSearch.classList.toggle("is-open", open);
      if (open){ setTimeout(function(){ try { elSInput.focus(); } catch(e){} }, 60); }
      else if (state.varQuery){ state.varQuery = ""; elSInput.value = ""; elSearch.classList.remove("has-text"); varSeiteZurueck(); renderVariations(); persist(); }
    });
    elSInput.addEventListener("input", function(){
      state.varQuery = String(elSInput.value || "").trim();
      varSeiteZurueck();
      elSearch.classList.toggle("has-text", !!elSInput.value.length);
      renderVariations();
      persist();
    });
    root.querySelector(".up-search-clear").addEventListener("click", function(){
      state.varQuery = ""; elSInput.value = ""; elSearch.classList.remove("has-text");
      varSeiteZurueck(); renderVariations(); persist(); try { elSInput.focus(); } catch(e){}
    });

    /* Der geteilte Tooltip. showTipWide zeigt den vollen Text, unsuppress hebt die Stummschaltung
       auf, die ein vorheriger Klick hinterlassen hat (STYLEGUIDE 30). */
    var tips = UC.makeTooltips ? UC.makeTooltips(root, darkNow) : null;

    /* Jede Erklaerkarte in dieser App faengt mit einer Beispielansicht an -- erst zeigen, wie die
       Spalte aussieht, dann sagen, was sie bedeutet. Sechs andere Komponenten machen das so
       (urls-table, prompts-table, responses-table, brands-overview, prompt-research,
       opportunities); diese beiden hier hatten nur Ueberschrift und Text und sahen deshalb
       neben den anderen wie eine andere Sorte Tooltip aus.

       Die Plaettchen sind aus DENSELBEN Bausteinen gebaut wie die echten Zellen -- derselbe
       Ring, dieselbe up-num, dasselbe "of N". Ein nachgemaltes Beispiel waere die Stelle, an
       der Karte und Spalte irgendwann auseinanderlaufen. */
    function varVisual(key){
      if (key === "sov"){
        /* Eine Zahl, dahinter derselbe Ring wie in der Zelle -- nicht zwei Zeilen. Die Platte
           soll die Spalte zeigen, nicht ihre Spannweite vorfuehren. */
        return '<span class="up-explain-row upd-explain-sov"><span class="up-num">62.5%</span>' + (UC.variationRing ? UC.variationRing(62.5) : "") + '</span>';
      }
      if (key === "cnt"){
        return '<span class="up-explain-row"><span class="up-num">19</span>' +
               '<span class="up-var-of">of 69</span></span>';
      }
      return '<span class="up-explain-row">Mercedes S500</span>' +
             '<span class="up-explain-row">Mercedes E Class</span>';
    }

    var KPI_ERKLAER = {
      kVis:  function(){ return UC.explainCopy ? UC.explainCopy("visibility", { scope: " on this topic" }) : null; },
      kRank: function(){ return UC.explainCopy ? UC.explainCopy("rank", { scope: " on this topic" }) : null; },
      kSent: function(){ return UC.explainCopy ? UC.explainCopy("sentiment", { scope: " on this topic" }) : null; },
      kMent: function(){ return { h: t("Mentions"), t: t("How many times the brand was named. Higher means the other numbers rest on more data.") }; }
    };
    if (UC.makeExplain){
      UC.makeExplain({
        root: root, getIsDark: darkNow,
        html: function(key){
          /* Die Kennzahlen (Kacheln und Spaltenkoepfe der Rangliste): die EINE Erklaerung je
             Kennzahl aus core (UC.explainCopy), mit "on this topic" -- dieselben Saetze wie in den
             Tabellen der App. Mentions hat dort keinen Eintrag; der Satz ist der der alten Kachel. */
          var k = KPI_ERKLAER[key];
          if (k){
            var ek = k();
            return ek ? '<div class="up-explain-h">' + esc(ek.h) + '</div>' +
                        '<div class="up-explain-t">' + esc(ek.t) + '</div>' : "";
          }
          var e = VAR_EXPLAIN[key];
          if (!e) return "";
          /* upd-explain-vis als Marke: die Erklaerkarte haengt im body, ausserhalb jeder
             .up-root -- die --vc-Tokens loesen dort NICHT auf. Ring und "of N" brauchen deshalb
             eigene Farben, und die Schriftgroesse laesst sich nur hier anheben, ohne die
             Erklaerkarten der sechs anderen Komponenten mitzuziehen. */
          return '<div class="up-explain-vis upd-explain-vis">' + varVisual(key) + '</div>' +
                 '<div class="up-explain-h">' + esc(e.h) + '</div>' +
                 '<div class="up-explain-t">' + esc(e.t) + '</div>';
        }
      });
    }

    /* Voller Variationsname beim Hover -- aber NUR wenn er wirklich abgeschnitten ist. Deshalb
       eine Messung (scrollWidth > clientWidth) statt eines Attributs: ein title= oder data-tip
       wuerde auch dann feuern, wenn der Name vollstaendig dasteht. */
    var nameTimer = null, nameEl = null;
    root.addEventListener("mouseover", function(e){
      var el = e.target.closest ? e.target.closest(".up-varname") : null;
      if (!el || !root.contains(el) || el === nameEl) return;
      nameEl = el;
      if (tips && tips.unsuppress) tips.unsuppress();
      clearTimeout(nameTimer);
      nameTimer = setTimeout(function(){
        if (tips && tips.showTipWide && el.scrollWidth > el.clientWidth + 1) tips.showTipWide(el, el.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var el = e.target.closest ? e.target.closest(".up-varname") : null;
      if (!el || el !== nameEl) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".up-varname") === el) return;
      nameEl = null; clearTimeout(nameTimer);
      if (tips && tips.hideTip) tips.hideTip();
    });
    /* NICHT im Sammellauf: chart.resize() rechnet das ganze Chart neu, und dieser Aufruf lief
       synchron in der Runde, die alle Komponenten der Seite anpasst -- ein einziger langer Block,
       aus dem die Konsole ihre Meldung macht. Jetzt haengt er an der Drossel und liegt hinter
       Chart.js' eigenem resizeDelay. */
    if (UC.aufResize) UC.aufResize(function(){ try { line.resize(); } catch(e){} }, { ms: 160 });
    else if (UC.onResize) UC.onResize(root, function(){
      clearTimeout(root.__updRespT);
      root.__updRespT = setTimeout(function(){ try { line.resize(); } catch(e){} }, 160);
    });
    /* Akzent gewechselt (06.10., "Standard + Blau"): die Kurve traegt ihre Farbe aus UC.chartInk, die
       Farbe steht beim Zeichnen fest -- also neu zeichnen. Andere Einstellungen zeichnet makeLine selbst. */
    if (UC.onPrefs) UC.onPrefs(function(d){
      if (root.isConnected === false || (d && d.name && d.name !== "accent")) return;
      renderChart();
    });

    /* ---------------- Oeffentliche Schnittstelle ---------------- */
    function paarSchluessel(co, tp){
      return String((co && co.company_id) || "") + "||" + String((tp && tp.topic_id) || "");
    }
    function setSelection(p){
      p = p || {};
      /* Der Payload kam an, war aber nicht lesbar -- normParams in core.js haengt dafuer
         __parseError an (§46). Ohne diesen Zweig traegt der Aufruf weder company noch topic:
         der Block bleibt im Ladezustand stehen und sagt nichts. Der Leerzustand ist hier schon
         da, er bekommt nur einen anderen Text -- "keine Zelle gewaehlt" waere gelogen. */
      if (p.__parseError){
        state.leseFehler = true;
        state.company = null; state.topic = null;
        setLoading(false); render(); persist(); return;
      }
      state.leseFehler = false;
      var neu = paarSchluessel(p.company, p.topic);
      var alt = paarSchluessel(state.company, state.topic);
      var wechsel = neu !== alt;

      state.company = p.company || null;
      state.topic   = p.topic || null;
      state.cell    = p.cell || null;
      state.column  = Array.isArray(p.topic_column) ? p.topic_column.slice() : [];
      state.row     = Array.isArray(p.brand_row) ? p.brand_row.slice() : [];

      /* Nur bei einer WIRKLICH anderen Kombination leeren. Sonst zeigte der Block die Variations
         der vorigen Marke unter dem neuen Kopf -- aber ein zweiter Aufruf fuer dieselbe Zelle
         (Bubble ruft render* gern mehrfach) darf nicht wegwerfen, was gerade geladen wurde. */
      if (wechsel){
        state.series = { topic: null, global: null };
        state.variations = null;
        varSeiteZurueck();
        state.globalKpis = null;
        /* Und SOFORT in den Ladezustand, ohne auf Bubble zu warten.

           Der Radar ruft diese Funktion synchron im Klick; der Workflow, dessen erster Schritt
           setPerformanceDetailLoading("yes") ist, startet erst danach -- und zwischen Klick und
           erstem Run-JS-Schritt liegen in Bubble ein bis zwei Sekunden. In dieser Luecke standen
           KPIs und Rangliste schon auf der neuen Zelle, sprangen dann ins Skelett und kamen
           gleich darauf zurueck. Dreimal wechseln fuer einen Klick.

           Wer die Auswahl wechselt, weiss selbst, dass ab jetzt geladen wird -- dafuer braucht es
           keine Nachricht von aussen. Bubbles setLoading("yes") bleibt trotzdem gueltig und
           schadet nicht, es setzt dann nur noch einmal, was schon steht. */
        state.loading = true;
        root.classList.add("is-loading");
      }
      /* Was VOR der Auswahl ankam, gehoert zu genau dieser Auswahl: die Run-JS-Schritte des
         Workflows und dieser Direktaufruf sind zwei Wege, deren Reihenfolge Bubble bestimmt.
         Ohne dieses Zwischenlager blieb der Block im Ladezustand stehen, obwohl beide Aufrufe
         durchgelaufen waren -- der haesslichste Fehler ueberhaupt, weil nichts danebengeht. */
      if (VORAB.variations != null){ state.variations = VORAB.variations; VORAB.variations = null; }
      if (VORAB.series.topic){ state.series.topic = VORAB.series.topic; VORAB.series.topic = null; }
      if (VORAB.series.global){ state.series.global = VORAB.series.global; VORAB.series.global = null; }
      if (VORAB.globalKpis){ state.globalKpis = VORAB.globalKpis; VORAB.globalKpis = null; }

      state.varQuery = ""; if (elSInput) elSInput.value = "";
      if (elSearch){ elSearch.classList.remove("has-text", "is-open"); }
      state.scope = "topic";
      if (elScope){
        var all = elScope.querySelectorAll(".up-seg-btn");
        for (var i = 0; i < all.length; i++) all[i].classList.toggle("is-active", all[i].getAttribute("data-scope") === "topic");
      }
      state.hasData = !!(state.company && state.topic);
      render();
      persist();
    }
    /* Sicherheitsnetz gegen einen Workflow, der sein setLoading("no") vergisst: sobald BEIDE
       nachgereichten Teile da sind -- Variations und die Kurve fuer den aktuellen Scope -- gibt es
       nichts mehr zu laden, also raus aus dem Ladezustand. Beide, nicht eins von beiden, sonst
       verschwindet das Skelett, waehrend der andere Teil noch unterwegs ist.
       Der ausdrueckliche Aufruf von aussen bleibt der normale Weg; das hier faengt nur den Fall,
       in dem er ausbleibt und der Block sonst fuer immer im Skelett stuende. */
    function ladezustandPruefen(){
      if (!state.loading) return;
      if (state.variations && state.series[state.scope]) setLoading(false);
    }

    function setVariations(rows){
      if (typeof rows === "string"){ try { rows = JSON.parse(rows); } catch(e){ rows = null; } }
      var list = Array.isArray(rows) ? rows : [];
      if (!state.company){ VORAB.variations = list; persist(); return; }
      state.variations = list;
      varSeiteZurueck();
      renderVariations();
      persist();
      ladezustandPruefen();
    }
    function setSeries(payload){
      if (typeof payload === "string"){ try { payload = JSON.parse(payload); } catch(e){ payload = null; } }
      if (!payload) return;
      var scope = payload.scope === "global" ? "global" : "topic";
      if (!state.company){ VORAB.series[scope] = payload; persist(); return; }
      state.series[scope] = payload;
      renderChart();
      persist();
      ladezustandPruefen();
    }
    function setGlobal(kpi){
      if (typeof kpi === "string"){ try { kpi = JSON.parse(kpi); } catch(e){ kpi = null; } }
      if (!state.company){ VORAB.globalKpis = kpi || null; persist(); return; }
      state.globalKpis = kpi || null;
      if (state.scope === "global") renderKpis();
      persist();
    }
    function setLoading(v){
      state.loading = UC.isYes ? UC.isYes(v) : (String(v) === "yes" || v === true);
      /* Ein NEUER Ladeversuch raeumt den Lesefehler weg -- sonst ueberlebt er jeden weiteren
         Versuch und steht noch da, waehrend frische Daten unterwegs sind. Der Text steht im
         Leerkasten, den nur render() anfasst -- die drei Teilzeichner unten erreichen ihn
         nicht, deshalb hier ausdruecklich render(). Gemessen: ohne das blieb er stehen. */
      if (state.loading && state.leseFehler){ state.leseFehler = false; render(); }
      root.classList.toggle("is-loading", state.loading);
      /* Alle drei, nicht nur die Kurve: KPIs und Rangliste haben jetzt eigene Skelette, und ein
         Bereich, in dem ein Teil laedt und der Rest noch die Zahlen der vorigen Zelle zeigt,
         sieht kaputt aus. Nur die drei neu zeichnen, nicht render() -- das wuerde auch Kopfzeile
         und Variations anfassen, die von dieser Ladephase gar nicht betroffen sind. */
      renderKpis();
      renderStanding();
      renderChart();
      /* Mitgemerkt in beide Richtungen: laedt der Bereich wirklich, zeigt auch ein Neuaufbau die
         Skelette (die Antwort kommt ja noch), ist er fertig, zeigt er die Zahlen. Ein
         Themewechsel allein setzt den Ladezustand nie. */
      persist();
    }
    function reset(){
      state.company = null; state.topic = null; state.cell = null;
      state.column = []; state.row = [];
      state.series = { topic: null, global: null };
      state.variations = null; state.globalKpis = null;
      VORAB.variations = null; VORAB.series = { topic: null, global: null }; VORAB.globalKpis = null;
      state.varQuery = ""; state.scope = "topic";
      state.hasData = false; state.loading = false;
      if (elSInput) elSInput.value = "";
      if (elSearch) elSearch.classList.remove("has-text", "is-open");
      root.classList.remove("is-loading");
      try { line.destroy(); } catch(e){}
      render();
      /* Der Reset erreicht auch den Speicher: er bekommt den geleerten Stand, sonst braechte der
         naechste Neuaufbau die Zelle zurueck, die gerade geschlossen wurde. */
      persist();
    }
    function setTheme(v){
      root.setAttribute("data-theme", String(v) === "dark" || v === true ? "dark" : "light");
      render();
    }

    /* Auf den Themewechsel hoeren, nicht nur auf den eigenen Setter.

       Diese Komponente hatte als einzige der Familie KEINEN Beobachter auf dem Wurzel-Div. Sie
       liest das Theme in render() -- aber render() lief bei einem globalen Wechsel nie, weil
       setUpstreemTheme nur das Attribut schreibt und keine Komponenten-API ruft. Ergebnis: die
       CSS-Flaechen kippten sofort (die haengen am Attribut), waehrend alles JS-Gezeichnete auf
       der alten Seite blieb -- am deutlichsten die Gitterlinien der Kurve, die weiter in
       Dunkelfarben standen, obwohl die Karte hell war.

       Derselbe Filter wie bei den Geschwistern, plus data-theme: applyThemeTo schreibt beide,
       und ein Beobachter, der nur eins davon kennt, ist genau die Sorte halbe Verdrahtung, die
       hier gefehlt hat. */
    new MutationObserver(function(){ render(); })
      .observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-theme"] });

    var ctrl = {
      __ctrlId: myCtrlId,
      setSelection: setSelection, setVariations: setVariations, setSeries: setSeries,
      setGlobal: setGlobal, setLoading: setLoading, reset: reset, setTheme: setTheme,
      render: render
    };
    /* Neuaufbau (siehe STORE): was nicht render() zeichnet, sondern fest im Rahmen steht, von Hand
       nachziehen. Das Suchfeld samt Suche -- ein zugeklapptes Feld ueber einer gefilterten Liste
       waere ein stiller Filter --, der Scope-Umschalter, falls er wieder eingesetzt ist, und die
       Ladeklasse. Ohne Eintrag im Speicher tut keine der drei Zeilen etwas. */
    if (state.varQuery && elSearch && elSInput){
      elSInput.value = state.varQuery;
      elSearch.classList.add("is-open", "has-text");
    }
    if (elScope){
      var scopeKnoepfe = elScope.querySelectorAll(".up-seg-btn");
      for (var sk = 0; sk < scopeKnoepfe.length; sk++){
        scopeKnoepfe[sk].classList.toggle("is-active", scopeKnoepfe[sk].getAttribute("data-scope") === state.scope);
      }
    }
    root.classList.toggle("is-loading", state.loading);
    root.__updController = ctrl;
    render();
    return ctrl;
  }

  /* ============================================================================================
     Mount
     ============================================================================================ */
  function initRoot(root){
    if (root.__updController) return;
    makeController(root);
  }
  function rootsFor(id){
    var out = [], all = document.querySelectorAll(".upd-root");
    id = id || "default";
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  var warnedFallback = false;
  function each(id, fn){
    var list = rootsFor(id);
    /* Kein Treffer, aber genau EIN Detailbereich auf der Seite: dann ist der gemeint. Der Radar
       reicht standardmaessig seine eigene data-instance durch, und die ist praktisch nie dieselbe
       wie die des Detail-Elements -- zwei Ids, die zueinander passen muessen, ohne dass irgendwo
       steht, dass sie das muessen. Das war eine Falle im Standardfall, nicht eine Einstellung.
       Die Id entscheidet weiterhin, sobald mehrere Bereiche auf der Seite liegen; nur dann ist
       sie ueberhaupt eine Aussage. Einmal protokollieren, damit der Zusammenhang auffindbar
       bleibt, aber nicht bei jedem Klick. */
    if (!list.length){
      var alle = document.querySelectorAll(".upd-root");
      if (alle.length === 1){
        if (!warnedFallback && window.console){
          warnedFallback = true;
          console.info("[performance-detail] call came in for data-instance=\"" + (id || "default") +
            "\", the single detail element on this page carries \"" +
            (alle[0].getAttribute("data-instance") || "default") + "\" — using it. Set matching " +
            "data-instance values (or data-detail-instance on the radar) to make this explicit.");
        }
        list = [alle[0]];
      } else if (window.console){
        console.warn("[performance-detail] no element with data-instance=\"" + (id || "default") +
          "\" on this page, and " + alle.length + " detail elements to choose from — the call was dropped.");
      }
    }
    list.forEach(function(r){ initRoot(r); if (r.__updController) fn(r.__updController); });
  }

  function doRender(p){
    if (typeof p === "string"){ try { p = JSON.parse(p); } catch(e){ p = null; } }
    if (!p){
      if (window.console) console.warn("[performance-detail] renderPerformanceDetail got no readable payload.");
      return;
    }
    each(p.instanceId || p.instance_id, function(c){ c.setSelection(p); });
  }
  function doVariations(id, rows){ each(id, function(c){ c.setVariations(rows); }); }
  function doSeries(id, payload){ each(id, function(c){ c.setSeries(payload); }); }
  function doGlobal(id, kpi){ each(id, function(c){ c.setGlobal(kpi); }); }
  function doLoading(id, v){ each(id, function(c){ c.setLoading(v); }); }
  function doReset(id){ each(id, function(c){ c.reset(); }); }
  function doTheme(id, v){ each(id, function(c){ c.setTheme(v); }); }

  UC.makeMount({
    rootClass: "upd-root",
    ctrlProp: "__updController",
    resolveLocal: "__updResolveLocal",
    queue: "__updBootQueue",
    initRoot: initRoot,
    api: {
      renderPerformanceDetail: doRender,
      setPerformanceDetailVariations: doVariations,
      setPerformanceDetailSeries: doSeries,
      setPerformanceDetailGlobal: doGlobal,
      setPerformanceDetailLoading: doLoading,
      resetPerformanceDetail: doReset,
      setPerformanceDetailTheme: doTheme
    },
    forwardShape: { renderPerformanceDetail: "params", resetPerformanceDetail: "id" }
  });
  }

  updBoot(50);
})();
