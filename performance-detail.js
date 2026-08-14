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
   Kurve, Variations und die URLs-Table darunter kommen ueber RPCs nach. */
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
                 "sentColor", "esc", "fmt1"]
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

  var esc = UC.esc, fmt1 = UC.fmt1, sentColor = UC.sentColor, toNum = UC.toNum;
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

  var SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var CLOSE_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  /* Markenkachel: dieselbe Geometrie wie der Brand-Mentions-Chip in den Tabellen
     (.up-stack-vis), inklusive Anfangsbuchstabe als Rueckfall ohne Logo. */
  function brandChipHtml(company){
    var name = String((company && company.name) || "");
    var logo = String((company && (company.favicon_url || company.favicon || company.logo_url || company.logo)) || "");
    if (logo.indexOf("//") === 0) logo = "https:" + logo;
    return '<span class="up-stack-item' + (logo ? " has-img" : "") + '">' +
             '<span class="up-stack-vis">' +
               '<span class="up-stack-ltr">' + esc(name.charAt(0) || "?") + '</span>' +
               /* KEIN loading="lazy": dieser Block oeffnet sich unter dem Falz, und lazy heisst
                  dort "erst laden, wenn jemand hinscrollt" -- die Kacheln blieben leer, obwohl
                  die URLs korrekt waren. Es sind hoechstens sieben Bilder. */
               (logo ? '<img src="' + esc(logo) + '" alt="" referrerpolicy="no-referrer"' +
                       ' onerror="this.closest(\'.up-stack-item\').classList.remove(\'has-img\'); this.remove()">' : "") +
             '</span>' +
           '</span>';
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
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  function thInfo(key){ return '<span class="up-th-info" data-explain="' + key + '">' + INFO_SVG + '</span>'; }
  var VAR_EXPLAIN = {
    name: { h: "Variation Name",
            t: "The exact wording an AI response used for this brand. Models rarely stick to one " +
               "spelling — every variation here counts as the same brand, and a name that never " +
               "appears is a name the models do not associate with you." },
    sov:  { h: "Share of Voice",
            t: "How much of this brand's mentions on this topic used this exact wording. High " +
               "numbers on one variation mean the models have settled on a name; a flat spread " +
               "across many means they have not." },
    cnt:  { h: "Mention Count",
            t: "How many times this wording appeared, out of all mentions of the brand on this " +
               "topic. The smaller the count, the less the share above rests on." }
  };

  /* ============================================================================================
     Controller pro Root
     ============================================================================================ */
  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "upd_" + Math.random().toString(36).slice(2) + "_" + (+new Date());

    var state = {
      company: null, topic: null, cell: null,
      column: [],            // alle Marken auf DIESEM Topic, aus dem Raster des Radars
      row: [],               // DIESE Marke ueber alle Topics, ebenfalls aus dem Raster
      scope: "topic",        // "topic" | "global"
      series: { topic: null, global: null },
      globalKpis: null,      // optional per Setter; sonst aus state.row gerechnet
      variations: null,      // null = noch nichts geliefert, [] = geliefert und leer
      varQuery: "",
      loading: false, hasData: false, isDark: false
    };
    /* Zwischenlager fuer Daten, die vor der Auswahl eintreffen. Siehe setSelection(). */
    var VORAB = { variations: null, series: { topic: null, global: null }, globalKpis: null };

    /* -------- Markup. Die Bubble-Datei traegt nur das Wurzel-Div; alles darunter baut die
       Komponente selbst. Es gibt hier keine Stellen, an denen der Nutzer etwas einsetzen soll,
       und ein von Hand eingefuegter Rahmen ist genau die Art Markup, die man beim naechsten
       Einbau halb vergisst. -------- */
    root.innerHTML =
      '<div class="upd-empty up-empty">' +
        '<div class="upd-empty-title">No cell selected</div>' +
        '<div class="upd-empty-sub">Pick a cell in the Performance Radar to see the details for that brand and topic.</div>' +
      '</div>' +
      '<div class="upd-body">' +
        '<div class="upd-head">' +
          '<div class="upd-title">' +
            '<span class="upd-brand"></span>' +
            '<span class="upd-x">&times;</span>' +
            '<span class="upd-topic"></span>' +
          '</div>' +
          /* Der Scope-Umschalter (This Topic | Global) ist vorerst raus. Er war schluessig, solange
             man nur auf die Kurve schaut -- die Rangliste daneben ist aber eine Aussage UEBER DIESES
             TOPIC ("Rang 6 von 10 auf diesem Topic"), und die gibt es global nicht. Sie verschwand
             darum beim Umschalten samt ihrer Spalte, und der Bereich sah in den zwei Zustaenden
             verschieden aus, ohne dass der Umschalter das ankuendigt.

             Nur das Bedienelement ist weg, nicht die Mechanik: state.scope, setPerformanceDetailSeries
             mit seinem scope-Feld, setPerformanceDetailGlobal und der updScope-Event stehen
             unveraendert. Zurueckholen heisst, diese vier Zeilen wieder einzusetzen -- vorausgesetzt,
             es gibt bis dahin eine Antwort darauf, was links neben einer globalen Kurve steht. */
          '<div class="upd-tools">' +
            '<button class="up-iconbtn upd-close" type="button" data-tip="Close details" aria-label="Close details">' + CLOSE_SVG + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="upd-kpis"></div>' +
        /* Rangliste links, Kurve rechts, ein Trenner dazwischen. Die beiden beantworten dieselbe
           Frage aus zwei Richtungen: wo steht die Marke gerade, und wie ist sie dahin gekommen.
           Untereinander muss man scrollen, um beides zu sehen. Unter der Schwelle stapelt es
           wieder, siehe is-narrow. */
        '<div class="upd-split">' +
          '<div class="upd-split-l upd-stand"></div>' +
          '<div class="upd-split-r upd-chartsec">' +
            '<div class="upd-sec-head"><span class="up-heading upd-sec-h">Visibility over time</span>' +
              '<span class="upd-sec-sub upd-scope-note"></span></div>' +
            '<div class="up-line-wrap upd-linewrap"><canvas class="up-line-canvas"></canvas></div>' +
          '</div>' +
        '</div>' +
        '<div class="upd-sec upd-varsec">' +
          '<div class="upd-sec-head">' +
            '<div class="upd-sec-titles">' +
              '<span class="up-heading upd-sec-h">Variations</span>' +
              '<span class="upd-sec-sub">Different brand names used in AI responses</span>' +
            '</div>' +
            '<div class="up-search upd-search">' +
              '<button class="up-iconbtn up-search-btn" type="button" data-tip="Search variations" aria-label="Search variations">' + SEARCH_SVG + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input" type="text" autocomplete="off" spellcheck="false" placeholder="Search variations">' +
                '<button class="up-search-clear" type="button" aria-label="Clear search">' + CLOSE_SVG + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="up-table upd-vartable">' +
            '<div class="up-thead upd-vrow">' +
              '<div class="up-th upd-th-name">Variation Name' + thInfo("name") + '</div>' +
              '<div class="up-th upd-th-sov">Share of Voice' + thInfo("sov") + '</div>' +
              '<div class="up-th upd-th-cnt">Mention Count' + thInfo("cnt") + '</div>' +
            '</div>' +
            '<div class="up-tbody upd-vbody"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var elBrand   = root.querySelector(".upd-brand");
    var elTopic   = root.querySelector(".upd-topic");
    var elKpis    = root.querySelector(".upd-kpis");
    var elStand   = root.querySelector(".upd-stand");
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
       schmalen Bubble-Gruppe stecken, waehrend das Fenster breit ist. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 900, vnarrowAt: 560 });

    function darkNow(){ return state.isDark; }
    function isOwner(){ return root.__updController && root.__updController.__ctrlId === myCtrlId; }

    var line = UC.makeLine({
      wrap: lineWrap, canvas: lineCv, legend: null,
      isDark: darkNow, isOwner: isOwner,
      gran: function(){ return "day"; },
      watermark: false
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
    function kpiTile(label, valueHtml, trendHtml, tip){
      return '<div class="upd-kpi"' + (tip ? ' data-tip="' + esc(tip) + '"' : "") + '>' +
               '<div class="upd-kpi-lbl">' + esc(label) + '</div>' +
               '<div class="upd-kpi-val">' + valueHtml +
                 (trendHtml ? '<span class="upd-kpi-trend">' + trendHtml + '</span>' : "") +
               '</div>' +
             '</div>';
    }
    /* ---------------- Ladezustand fuer KPIs und Rangliste ----------------
       Bisher hing am Ladezustand nur die Kurve; KPIs und Rangliste wurden gedimmt und zeigten
       weiter die Zahlen der vorigen Zelle. Beim Zellwechsel stand damit ein Teil des Bereichs
       schon auf den neuen Daten, waehrend daneben noch die alten standen -- und alte Zahlen zu
       zeigen ist schlimmer als gar keine, weil man ihnen nicht ansieht, dass sie von gestern sind.

       Die Skelette haben die Form ihrer echten Geschwister: vier Kacheln in derselben Reihe,
       sieben Zeilen mit Rang, Logo, Name und Wert. Bausteine aus core (up-sk-lbl/-dot/-pct), damit
       das Schimmern ueberall dasselbe ist. */
    /* Sieben statt fuenf: neben der Kurve ist die Spalte hoch genug dafuer, und zwei Plaetze mehr
       zeigen im Zweifel den ganzen relevanten Ausschnitt statt eines Anschnitts. Steht hier oben,
       weil das Skelett dieselbe Zeilenzahl braucht wie die echte Liste -- sonst springt die Hoehe
       in dem Moment, in dem die Daten ankommen. */
    var FENSTER = 7;

    function kpiSkeleton(){
      var tile = '<div class="upd-kpi">' +
                   '<div class="upd-kpi-lbl"><span class="up-sk-lbl" style="width:62px"></span></div>' +
                   '<div class="upd-kpi-val"><span class="up-sk-lbl" style="width:54px;height:18px"></span></div>' +
                 '</div>';
      return tile + tile + tile + tile;
    }
    function standSkeleton(){
      var rows = "";
      for (var i = 0; i < FENSTER; i++){
        /* Namen unterschiedlich lang, sonst liest sich der Block wie ein Balkendiagramm. */
        var w = [96, 74, 112, 88, 68, 104, 82][i % 7];
        rows += '<div class="upd-stand-row is-sk">' +
                  '<span class="up-sk-lbl" style="width:10px"></span>' +
                  '<span class="up-sk-dot" style="width:22px;height:22px;border-radius:6px"></span>' +
                  '<span class="up-sk-lbl" style="width:' + w + 'px"></span>' +
                  '<span class="up-sk-pct" style="width:38px;margin-left:auto"></span>' +
                '</div>';
      }
      return '<div class="upd-stand-head"><span class="up-sk-lbl" style="width:210px"></span></div>' +
             '<div class="upd-stand-list">' + rows + '</div>';
    }

    function renderKpis(){
      if (state.loading){ elKpis.innerHTML = kpiSkeleton(); return; }
      var src = kpiSource(), k = src.kpi;
      var vis = num(k.visibility_pct), sv = num(k.sentiment), rv = num(k.avg_rank);
      var ment = num(k.mentions), mentPrev = num(k.mentions_prev);
      var mentDelta = (ment != null && mentPrev != null) ? (ment - mentPrev) : null;
      var dash = '<span class="upd-dash">-</span>';

      var visHtml  = vis == null ? dash : '<span class="up-num">' + fmtPctShort(vis, true) + '</span>';
      var sentHtml = sv == null ? dash
        : '<span class="up-sent"><span class="up-sent-dot" style="background:' + sentColor(sv) + '"></span>' +
          '<span class="up-sent-val">' + Math.round(sv) + '</span></span>';
      var rankHtml = rv == null ? dash
        : '<span class="up-rank-group">' + HASH_SVG + '<span class="up-num">' + fmt1(rv) + '</span></span>';
      var mentHtml = ment == null ? dash : '<span class="up-num">' + Math.round(ment) + '</span>';

      var t = UC.trendChip;
      elKpis.innerHTML =
        kpiTile("Visibility", visHtml, t ? t(num(k.visibility_delta_pct), { decimals: true, suffix: "%" }) : "",
                "Share of responses this brand appears in.") +
        /* Rank ist invertiert: die kleinere Zahl ist die bessere, also ist ein negatives Delta gruen. */
        kpiTile("Avg. Rank", rankHtml, t ? t(num(k.avg_rank_delta), { decimals: true, inverted: true }) : "",
                "Average position among the brands named in a response.") +
        kpiTile("Sentiment", sentHtml, t ? t(num(k.sentiment_delta), {}) : "",
                "How positively the brand is described, 0 to 100.") +
        kpiTile("Mentions", mentHtml, t ? t(mentDelta, {}) : "",
                "How many times the brand was named. Higher means the other numbers rest on more data.");

      /* Der Hinweis gehoert zum Scope-Umschalter und ist mit ihm raus. Die Zeile bleibt
         defensiv, damit ein wieder eingesetzter Umschalter sie sofort wieder fuellt. */
      if (elNote){
        elNote.textContent = state.scope === "global"
          ? (src.derived ? "Average across all topics in the radar" : "Across all tracked prompts")
          : "";
      }
    }

    /* ---------------- Standing auf diesem Topic ----------------
       Kostet keinen einzigen Serveraufruf: die Spalte des Rasters liegt schon vor. */
    function renderStanding(){
      if (state.loading){
        root.classList.remove("no-stand");   // die Spalte bleibt stehen, sonst springt das Layout
        elStand.innerHTML = standSkeleton();
        return;
      }
      var col = (state.column || []).filter(function(c){ return c && num(c.visibility_pct) != null; });
      if (state.scope !== "topic" || !state.company || col.length < 2){
        elStand.innerHTML = "";
        root.classList.add("no-stand");     // linke Spalte faellt weg, die Kurve nimmt die Breite
        return;
      }
      root.classList.remove("no-stand");
      col.sort(function(a, b){ return num(b.visibility_pct) - num(a.visibility_pct); });

      var myId = String(state.company.company_id);
      var myIdx = -1;
      for (var i = 0; i < col.length; i++) if (String(col[i].company_id) === myId){ myIdx = i; break; }
      var leader = col[0], mine = myIdx >= 0 ? col[myIdx] : null;

      var head;
      if (myIdx === 0){
        head = '<strong>Leading</strong> this topic, ' +
               (col.length > 1 ? fmtPctShort(num(col[0].visibility_pct) - num(col[1].visibility_pct)) +
                                 ' ahead of <span class="upd-rk">#</span>2 ' + esc(String(col[1].name || "")) : "");
      } else if (mine){
        head = 'Rank <strong>' + (myIdx + 1) + '</strong> of ' + col.length + ' on this topic, ' +
               fmtPctShort(num(leader.visibility_pct) - num(mine.visibility_pct)) +
               /* Mit Rang davor: "behind Volvo" laesst offen, ob Volvo der Erste ist oder
                  irgendwer dazwischen. Das Rautenzeichen in Drittfarbe, wie ueberall sonst. */
               ' behind <span class="upd-rk">#</span>1 ' + esc(String(leader.name || ""));
      } else {
        head = 'Not among the ' + col.length + ' brands tracked on this topic';
      }

      /* Fuenf Zeilen, und die eigene Marke steht darin so mittig wie moeglich: zwei darueber, zwei
         darunter. Das ist der Ausschnitt, der die Frage beantwortet -- wen habe ich gerade vor mir
         und wer sitzt mir im Nacken. Eine Liste, die immer bei Rang 1 anfaengt, zeigt bei Rang 9
         fuenf Marken, mit denen die eigene nichts zu tun hat.
         Am Rand rutscht das Fenster nach innen statt ueber die Liste hinaus: bei Rang 2 also
         1 bis 5, beim Letzten die letzten fuenf. Ist die Marke gar nicht in der Spalte, bleibt es
         bei den Top 5. */
      var start = 0;
      if (myIdx >= 0) start = Math.max(0, Math.min(myIdx - Math.floor(FENSTER / 2), col.length - FENSTER));
      var show = col.slice(start, start + FENSTER);

      elStand.innerHTML =
        '<div class="upd-stand-head">' + head + '</div>' +
        '<div class="upd-stand-list">' + show.map(function(c){
          var v = num(c.visibility_pct) || 0;
          var self = String(c.company_id) === myId;
          var realIdx = col.indexOf(c);
          return '<div class="upd-stand-row' + (self ? " is-self" : "") + '" role="button" tabindex="0"' +
                   ' data-cid="' + esc(String(c.company_id)) + '"' +
                   ' data-cname="' + esc(String(c.name || "")) + '">' +
                   '<span class="upd-stand-idx">' + (realIdx + 1) + '</span>' +
                   brandChipHtml(c) +
                   '<span class="upd-stand-name">' + esc(String(c.name || "")) + '</span>' +
                   '<span class="upd-stand-val up-num">' + fmtPctShort(v, true) + '</span>' +
                 '</div>';
        }).join("") + '</div>';
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
      /* Linienfarbe: der Farbwert, den eine Heatmap-Zelle bei 65 Prozent haette -- aus derselben
         Rampe und damit automatisch pro Theme richtig. Die Kurve gehoert sichtbar zum Radar
         darueber, und ein Blau aus dessen eigener Skala sagt das, ohne dass hier ein Farbwert
         steht, den beim naechsten Palettenwechsel niemand mitzieht. */
      var rgb = UC.heatAt ? UC.heatAt(root, 0.65) : [100, 132, 168];
      var linie = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
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
    var RING_R = 6, RING_C = 2 * Math.PI * RING_R;
    function ringHtml(pct){
      var p = pct == null || isNaN(pct) ? 0 : Math.max(0, Math.min(100, Number(pct)));
      var an = (p / 100) * RING_C;
      return '<span class="upd-ring" aria-hidden="true">' +
        '<svg viewBox="0 0 16 16" width="16" height="16">' +
          '<circle class="upd-ring-track" cx="8" cy="8" r="' + RING_R + '" fill="none" stroke-width="2.4"/>' +
          '<circle class="upd-ring-fill" cx="8" cy="8" r="' + RING_R + '" fill="none" stroke-width="2.4"' +
            ' stroke-dasharray="' + an.toFixed(2) + ' ' + (RING_C - an).toFixed(2) + '"' +
            ' transform="rotate(-90 8 8)" stroke-linecap="round"/>' +
        '</svg></span>';
    }
    function varRows(){
      var list = state.variations || [];
      var q = state.varQuery.toLowerCase();
      if (!q) return list;
      return list.filter(function(v){ return String(v.name || "").toLowerCase().indexOf(q) !== -1; });
    }
    function renderVariations(){
      if (state.variations == null){
        /* rowClass MIT up-row und cellClass MIT up-td: daran haengen das Spaltenraster
           (--up-cols), die Polsterung und die Zeilenhoehe. Ohne sie stand der Skeleton ohne Grid
           da -- drei Balken untereinander statt in den Spalten der Tabelle. Die Balkenbreiten
           entsprechen dem, was spaeter wirklich dort steht: Name lang, Prozent kurz, Anzahl kurz. */
        elVBody.innerHTML = UC.skeletonRows
          ? UC.skeletonRows({ count: 6,
                              cols: [{ w: 120, jitter: 40 }, { w: 44 }, { w: 28 }],
                              rowClass: "up-row upd-vrow", cellClass: "up-td" })
          : "";
        return;
      }
      var rows = varRows();
      if (!rows.length){
        elVBody.innerHTML = '<div class="up-empty-mini">' +
          (state.varQuery ? "No variation matches this search." : "No variations recorded for this combination.") +
          '</div>';
        return;
      }
      /* mentions_total ist die Bezugsgroesse fuer Mention Count, share_of_voice_pct kommt fertig.
         NICHT total_count: das zaehlt die verschiedenen Variationen, nicht die Erwaehnungen --
         "3 of 12" las sich damit als "3 von 12 Erwaehnungen", gemeint waren aber 12 Variationen.
         Zwei Groessen mit aehnlichem Namen, und die falsche stand im Nenner. */
      elVBody.innerHTML = rows.map(function(v){
        var sov = num(v.share_of_voice_pct);
        var cnt = num(v.mentioned_count);
        var tot = num(v.mentions_total);
        return '<div class="up-row upd-vrow">' +
                 '<div class="up-td upd-td-name"><span class="upd-varname">' +
                   highlight(String(v.name || ""), state.varQuery) + '</span></div>' +
                 '<div class="up-td upd-td-sov">' +
                   '<span class="up-num">' + (sov == null ? "-" : fmtPctShort(sov, true)) + '</span>' +
                   ringHtml(sov) +
                 '</div>' +
                 '<div class="up-td upd-td-cnt">' +
                   '<span class="up-num">' + (cnt == null ? "-" : Math.round(cnt)) + '</span>' +
                   (tot != null ? '<span class="upd-of">of ' + Math.round(tot) + '</span>' : "") +
                 '</div>' +
               '</div>';
      }).join("");
    }

    /* ---------------- Gesamt-Render ---------------- */
    function render(){
      if (!isOwner()) return;
      syncTheme();
      var on = !!(state.company && state.topic);
      root.classList.toggle("has-selection", on);
      if (!on) return;
      elBrand.innerHTML = brandChipHtml(state.company) +
        '<span class="upd-brand-name">' + esc(String(state.company.name || "")) + '</span>';
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
      var row = e.target.closest ? e.target.closest(".upd-stand-row") : null;
      if (!row) return;
      fireCompanyClick(row);
    });
    /* Tastatur: die Zeile ist ein Button, also muss sie auch auf Enter und Leertaste hoeren. */
    elStand.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest ? e.target.closest(".upd-stand-row") : null;
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
      else if (state.varQuery){ state.varQuery = ""; elSInput.value = ""; elSearch.classList.remove("has-text"); renderVariations(); }
    });
    elSInput.addEventListener("input", function(){
      state.varQuery = String(elSInput.value || "").trim();
      elSearch.classList.toggle("has-text", !!elSInput.value.length);
      renderVariations();
    });
    root.querySelector(".up-search-clear").addEventListener("click", function(){
      state.varQuery = ""; elSInput.value = ""; elSearch.classList.remove("has-text");
      renderVariations(); try { elSInput.focus(); } catch(e){}
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
        return '<span class="up-explain-row upd-explain-sov"><span class="up-num">62.5%</span>' + ringHtml(62.5) + '</span>';
      }
      if (key === "cnt"){
        return '<span class="up-explain-row"><span class="up-num">19</span>' +
               '<span class="upd-of">of 69</span></span>';
      }
      return '<span class="up-explain-row">Mercedes S500</span>' +
             '<span class="up-explain-row">Mercedes E Class</span>';
    }

    if (UC.makeExplain){
      UC.makeExplain({
        root: root, getIsDark: darkNow,
        html: function(key){
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
      var el = e.target.closest ? e.target.closest(".upd-varname") : null;
      if (!el || !root.contains(el) || el === nameEl) return;
      nameEl = el;
      if (tips && tips.unsuppress) tips.unsuppress();
      clearTimeout(nameTimer);
      nameTimer = setTimeout(function(){
        if (tips && tips.showTipWide && el.scrollWidth > el.clientWidth + 1) tips.showTipWide(el, el.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var el = e.target.closest ? e.target.closest(".upd-varname") : null;
      if (!el || el !== nameEl) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".upd-varname") === el) return;
      nameEl = null; clearTimeout(nameTimer);
      if (tips && tips.hideTip) tips.hideTip();
    });
    if (UC.onResize) UC.onResize(root, function(){ try { line.resize(); } catch(e){} });

    /* ---------------- Oeffentliche Schnittstelle ---------------- */
    function paarSchluessel(co, tp){
      return String((co && co.company_id) || "") + "||" + String((tp && tp.topic_id) || "");
    }
    function setSelection(p){
      p = p || {};
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
      if (!state.company){ VORAB.variations = list; return; }
      state.variations = list;
      renderVariations();
      ladezustandPruefen();
    }
    function setSeries(payload){
      if (typeof payload === "string"){ try { payload = JSON.parse(payload); } catch(e){ payload = null; } }
      if (!payload) return;
      var scope = payload.scope === "global" ? "global" : "topic";
      if (!state.company){ VORAB.series[scope] = payload; return; }
      state.series[scope] = payload;
      renderChart();
      ladezustandPruefen();
    }
    function setGlobal(kpi){
      if (typeof kpi === "string"){ try { kpi = JSON.parse(kpi); } catch(e){ kpi = null; } }
      if (!state.company){ VORAB.globalKpis = kpi || null; return; }
      state.globalKpis = kpi || null;
      if (state.scope === "global") renderKpis();
    }
    function setLoading(v){
      state.loading = UC.isYes ? UC.isYes(v) : (String(v) === "yes" || v === true);
      root.classList.toggle("is-loading", state.loading);
      /* Alle drei, nicht nur die Kurve: KPIs und Rangliste haben jetzt eigene Skelette, und ein
         Bereich, in dem ein Teil laedt und der Rest noch die Zahlen der vorigen Zelle zeigt,
         sieht kaputt aus. Nur die drei neu zeichnen, nicht render() -- das wuerde auch Kopfzeile
         und Variations anfassen, die von dieser Ladephase gar nicht betroffen sind. */
      renderKpis();
      renderStanding();
      renderChart();
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
