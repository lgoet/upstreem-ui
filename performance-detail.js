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
  var MISSING = ["makeMount", "makeLine", "buildLineDatasets", "makeTooltips", "makeFire", "trendChip",
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
  var HASH_SVG = UC.HASH_ICON ? UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ') : "";

  /* Formatierung nach STYLEGUIDE 1c: Prozente ohne Nachkommastelle, wenn sie ganz sind. */
  function fmtPctShort(v){
    if (v == null || isNaN(v)) return "-";
    var n = Number(v);
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
          '<div class="upd-tools">' +
            '<div class="up-seg upd-scope" role="tablist">' +
              '<button class="up-seg-btn is-active" type="button" data-scope="topic">This Topic</button>' +
              '<button class="up-seg-btn" type="button" data-scope="global">Global</button>' +
            '</div>' +
            '<button class="up-iconbtn upd-close" type="button" data-tip="Close details" aria-label="Close details">' + CLOSE_SVG + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="upd-kpis"></div>' +
        '<div class="upd-stand"></div>' +
        '<div class="upd-sec upd-chartsec">' +
          '<div class="upd-sec-head"><span class="up-heading upd-sec-h">Visibility over time</span>' +
            '<span class="upd-sec-sub upd-scope-note"></span></div>' +
          '<div class="up-line-wrap upd-linewrap"><canvas class="up-line-canvas"></canvas></div>' +
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
              '<div class="up-th upd-th-name">Variation Name</div>' +
              '<div class="up-th upd-th-sov">Share of Voice</div>' +
              '<div class="up-th upd-th-cnt">Mention Count</div>' +
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
    function renderKpis(){
      var src = kpiSource(), k = src.kpi;
      var vis = num(k.visibility_pct), sv = num(k.sentiment), rv = num(k.avg_rank);
      var ment = num(k.mentions), mentPrev = num(k.mentions_prev);
      var mentDelta = (ment != null && mentPrev != null) ? (ment - mentPrev) : null;
      var dash = '<span class="upd-dash">-</span>';

      var visHtml  = vis == null ? dash : '<span class="up-num">' + fmtPctShort(vis) + '</span>';
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

      elNote.textContent = state.scope === "global"
        ? (src.derived ? "Average across all topics in the radar" : "Across all tracked prompts")
        : "";
    }

    /* ---------------- Standing auf diesem Topic ----------------
       Kostet keinen einzigen Serveraufruf: die Spalte des Rasters liegt schon vor. */
    function renderStanding(){
      var col = (state.column || []).filter(function(c){ return c && num(c.visibility_pct) != null; });
      if (state.scope !== "topic" || !state.company || col.length < 2){ elStand.innerHTML = ""; return; }
      col.sort(function(a, b){ return num(b.visibility_pct) - num(a.visibility_pct); });

      var myId = String(state.company.company_id);
      var myIdx = -1;
      for (var i = 0; i < col.length; i++) if (String(col[i].company_id) === myId){ myIdx = i; break; }
      var leader = col[0], mine = myIdx >= 0 ? col[myIdx] : null;

      var head;
      if (myIdx === 0){
        head = '<strong>Leading</strong> this topic, ' +
               (col.length > 1 ? fmtPctShort(num(col[0].visibility_pct) - num(col[1].visibility_pct)) +
                                 ' ahead of ' + esc(String(col[1].name || "")) : "");
      } else if (mine){
        head = 'Rank <strong>' + (myIdx + 1) + '</strong> of ' + col.length + ' on this topic, ' +
               fmtPctShort(num(leader.visibility_pct) - num(mine.visibility_pct)) +
               ' behind ' + esc(String(leader.name || ""));
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
      var FENSTER = 5;
      var start = 0;
      if (myIdx >= 0) start = Math.max(0, Math.min(myIdx - Math.floor(FENSTER / 2), col.length - FENSTER));
      var show = col.slice(start, start + FENSTER);

      elStand.innerHTML =
        '<div class="upd-stand-head">' + head + '</div>' +
        '<div class="upd-stand-list">' + show.map(function(c){
          var v = num(c.visibility_pct) || 0;
          var self = String(c.company_id) === myId;
          var realIdx = col.indexOf(c);
          return '<div class="upd-stand-row' + (self ? " is-self" : "") + '">' +
                   '<span class="upd-stand-idx">' + (realIdx + 1) + '</span>' +
                   brandChipHtml(c) +
                   '<span class="upd-stand-name">' + esc(String(c.name || "")) + '</span>' +
                   '<span class="upd-stand-val up-num">' + fmtPctShort(v) + '</span>' +
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
      var comp = state.company ? [{
        company_id: cid, name: state.company.name,
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
          '<circle class="upd-ring-track" cx="8" cy="8" r="' + RING_R + '" fill="none" stroke-width="3"/>' +
          '<circle class="upd-ring-fill" cx="8" cy="8" r="' + RING_R + '" fill="none" stroke-width="3"' +
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
        elVBody.innerHTML = UC.skeletonRows
          ? UC.skeletonRows({ count: 5, cols: [{ w: 180, jitter: 60 }, { w: 60 }, { w: 40 }],
                              rowClass: "upd-vrow", cellClass: "" })
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
      /* total_count ist die Bezugsgroesse fuer Mention Count, share_of_voice_pct kommt fertig. */
      elVBody.innerHTML = rows.map(function(v){
        var sov = num(v.share_of_voice_pct);
        var cnt = num(v.mentioned_count);
        var tot = num(v.total_count);
        return '<div class="up-row upd-vrow">' +
                 '<div class="up-td upd-td-name" data-tiptrunc>' + esc(String(v.name || "")) + '</div>' +
                 '<div class="up-td upd-td-sov">' +
                   '<span class="up-num">' + (sov == null ? "-" : fmtPctShort(sov)) + '</span>' +
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

    /* ---------------- Verdrahtung ---------------- */
    elScope.addEventListener("click", function(e){
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

    if (UC.makeTooltips) UC.makeTooltips(root, darkNow);
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
      var all = elScope.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < all.length; i++) all[i].classList.toggle("is-active", all[i].getAttribute("data-scope") === "topic");
      state.hasData = !!(state.company && state.topic);
      render();
    }
    function setVariations(rows){
      if (typeof rows === "string"){ try { rows = JSON.parse(rows); } catch(e){ rows = null; } }
      var list = Array.isArray(rows) ? rows : [];
      if (!state.company){ VORAB.variations = list; return; }
      state.variations = list;
      renderVariations();
    }
    function setSeries(payload){
      if (typeof payload === "string"){ try { payload = JSON.parse(payload); } catch(e){ payload = null; } }
      if (!payload) return;
      var scope = payload.scope === "global" ? "global" : "topic";
      if (!state.company){ VORAB.series[scope] = payload; return; }
      state.series[scope] = payload;
      renderChart();
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
