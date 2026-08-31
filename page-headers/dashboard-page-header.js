/* upstreem dashboard-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first: reuses UC.isYes/UC.makeFire/UC.makeMount/UC.trendChip and the shared .up-root CSS
   variables, plus the Page Header Kit's meta/heading/description styling (core.css's ".up-ph-*"
   classes) -- same as prompts-page-header.js. No subpage nav here (this page has none) and no
   separator row underneath either -- same bare layout as performance-page-header.js -- so the
   markup ends right after the top row.

   Unlike prompts-page-header.js, this component has one real piece of server data (the KPI
   numbers), delivered once at page load via a setter call rather than read off a static
   attribute -- so, unlike that file, this one DOES need the stub-queue/UC.makeMount plumbing
   every table/chart in this repo already uses (see topics-manager.js for the same pattern with a
   single setter). */
(function(){
  "use strict";

  /* Stub queue: if Bubble calls setDashboardPageHeaderKpis() before this script has finished
     loading (a real race -- the CDN loader fetches core.js and this file in sequence, and Bubble's
     own "set the KPIs" workflow step can run before either resolves), the call queues here instead
     of throwing on a function that doesn't exist yet. UC.makeMount replays the queue once it's
     ready. Guarded by __dphBootStubbed so a second copy of this script (Bubble re-injecting the
     element's markup) doesn't reinstall the stub over a queue that may already hold calls. */
  var __dphBootQueue = window.__dphBootQueue = window.__dphBootQueue || [];
  if (!window.__dphBootStubbed){
    window.__dphBootStubbed = true;
    ["setDashboardPageHeaderKpis"].forEach(function(n){
      window[n] = function(){ __dphBootQueue.push([n, arguments]); };
    });
  }

  function dphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ dphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    dphRun();
  }

  var UC, mount;

  function dphRun(){
    UC = window.UpstreemCore;

    /* Laut sagen, WAS fehlt. Ein "undefined is not a function" schickt einen auf die Suche im
       falschen File; der Name des fehlenden Kits zeigt direkt auf den veralteten Pin. */
    var fehlt = ["makePageHeaderMeta", "makePageNav", "spinOnce", "makeTooltips"].filter(function(n){ return !UC[n]; });
    if (fehlt.length && window.console) console.error("upstreem: core.js ist zu alt, es fehlen: " +
      fehlt.join(", ") + ". data-cdn-pin dieses Page-Headers auf einen aktuellen Commit setzen.");

    mount = UC.makeMount({
      /* onMount: makeMount replays Bubble's queued setDashboardPageHeaderKpis calls while it is
         still constructing, i.e. before `mount` below has been assigned -- capturing it via this
         callback (not the makeMount() return value) is what makes the very first queued call, if
         any, see a defined `mount` instead of throwing. Same pattern as topics-manager.js. */
      onMount: function(m){ mount = m; },
      rootClass: "dph-root", notPortal: true,
      ctrlProp: "__dphController",
      resolveLocal: "__dphResolveLocal",
      queue: "__dphBootQueue",
      initRoot: initRoot,
      api: { setDashboardPageHeaderKpis: doSetKpis }
      /* No forwardShape entry: setDashboardPageHeaderKpis(instanceId, kpis) is a plain (id, value)
         call, which is makeMount's default forwarding shape -- only "params"/"id"-shaped setters
         need an explicit entry here. */
    });
  }

  function rootsWithId(id){ return mount.rootsWithId(id); }

  /* Picks the visible instance when the same component is placed more than once on a page (a
     hidden/not-yet-shown duplicate, e.g. behind an unopened drawer, would otherwise win ties by
     DOM order) -- same tie-break topics-manager.js uses for its own resolve(). */
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  /* kpis may arrive as a real array OR as a STRING holding one. The string form exists because
     Bubble builds the Run-JavaScript step as text: an unfilled dynamic expression leaves nothing
     at all behind, so setDashboardPageHeaderKpis("id", [{"avg_rank_prev": , ...}]) reaches the
     browser as a JS SYNTAX ERROR and the whole step dies before this file gets a say. Quoting the
     array turns that from executable code into inert data, and UC.parseLoose puts the missing
     values back as null (plus the usual Bubble damage: NBSP indents, curly quotes, entities,
     unquoted keys). Passing a real array still works exactly as before -- parseLoose returns
     objects untouched -- so nothing that already works needs changing. */
  function doSetKpis(id, kpis){
    var ctrl = resolve(id);
    if (!ctrl) return false;
    var list = UC.parseLoose ? UC.parseLoose(kpis, "dashboard-page-header") : kpis;
    /* A single object instead of a one-element array is the other shape Bubble hands over easily;
       accept it rather than render an empty strip over a punctuation detail. */
    if (list && !isArr(list)) list = [list];
    ctrl.setKpis(list);
    return true;
  }
  function isArr(v){ return Object.prototype.toString.call(v) === "[object Array]"; }

  /* One controller object per root, cached on the root itself (ctrlProp) so a second resolve()
     call against the same still-live root reuses it instead of re-wiring listeners. */
  function initRoot(root){
    if (root.__dphController) return root.__dphController;
    var ctrl = buildController(root);
    root.__dphController = ctrl;
    return ctrl;
  }

  function fmtRank(v){
    var n = Number(v);
    return isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "–";
  }
  function fmtInt(v){
    var n = Number(v);
    return isFinite(n) ? String(Math.round(n)) : "–";
  }

  function buildController(root){
    var fire = UC.makeFire(root, { label: "dashboard-page-header", eventPrefix: "dph" });

    /* Same data-brand-name/-logo/-isdark re-sync as prompts-page-header.js, same reason: Bubble
       can resolve those dynamic expressions after this root is already mounted, patching the
       attribute in place rather than replacing the node. */
    /* Fehlt das Kit, ist eine ALTE core.js geladen -- typisch bei leerem data-cdn-pin: dann zieht
       der Loader "@main", und jsDelivr/Browser liefern das aus einem bis zu tagealten Cache. Auf
       einem Rechner laeuft die neue Fassung, auf dem naechsten die alte. Frueher riss der TypeError
       hier den ganzen initRoot mit: keine Meta-Zeile, keine Nav, und weil dieses Kit auch die
       data-isdark-Nachsynchronisierung macht, beim ersten Laden auch das falsche Theme. */
    if (UC.makePageHeaderMeta) UC.makePageHeaderMeta(root);

    /* No page nav here, so nothing else would set the responsive tier classes -- and without
       is-vnarrow the 32px top clearance for Bubble's mobile sidebar toggle never applies. */
    if (UC.widthTiers) UC.widthTiers(root);

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });

    var refreshBtn = root.querySelector(".dph-refreshbtn");
    if (refreshBtn){
      refreshBtn.addEventListener("click", function(){
        UC.spinOnce(refreshBtn);
        fire("data-refresh-fn", "dphRefresh", {});
      });
    }
    /* ---------- drei Aenderungen am gelieferten Markup, aus JS und nicht aus der Vorlage ----------
       bubble/*.html ist eine Vorlage fuer NEUINSTALLATIONEN: was dort steht, erreicht ein bereits
       eingebautes Element nie mehr. Diese drei Dinge muessen also von hier kommen, damit sie mit
       dem CDN-Pin ankommen. Die Vorlage ist gleichzeitig nachgezogen, fuer die naechste frische
       Seite. Alles idempotent -- initRoot kann mehrfach laufen. */
    (function markupNachziehen(){
      /* 1. Die Meta-Zeile: nichts mehr zu tun. Sie stand hier als Sonderfall des Dashboards und
            wurde ausgebaut; jetzt blendet core sie fuer JEDEN Seitenkopf aus
            (.up-ph-root .up-ph-meta { display: none }), und ein zweiter Weg fuer dieselbe Sache
            waere die naechste Stelle, die auseinanderlaeuft. UC.makePageHeaderMeta laeuft
            weiter -- es macht auch die data-isdark-Nachsynchronisierung. */


      /* 2. Der Docs-Knopf traegt nur noch sein Zeichen -- library-big aus core, DASSELBE, das im
            Onboarding-Kopf am Begleitkasten "Guide" haengt. Vorher stand dort ein Buch-SVG plus
            das Wort "Docs", dann kurz graduation-cap.
            Warum getauscht: graduation-cap ist breit und flach, refresh-cw daneben fuellt sein
            Quadrat ganz aus -- bei gleicher Kastengroesse (beide 16 in 32) sahen die zwei
            Zeichen verschieden gross aus, und genau so wurde es gemeldet. library-big ist hoch
            und schmal wie refresh-cw rund ist: gleiche Kantenlaenge, gleicher Eindruck. Und es
            ist ohnehin das Zeichen, das diese App fuer "Anleitung" benutzt.
            Beschriftung faellt weg, der Tooltip bleibt (data-tip steht im Markup) und ein
            aria-label kommt dazu: ein Knopf, der nur aus einem Zeichen besteht, braucht seinen
            Namen fuer die Vorlesehilfe.
            .up-ph-iconbtn ist das Bauteil dafuer -- 32x32, dasselbe wie der Refresh-Knopf
            daneben; .dph-docsbtn bleibt am Element, die Klasse steht im Vertrag.
            Strichstaerke 1.8 wie im Onboarding-Kopf -- dort haengt dasselbe Zeichen, und die
            drei Knoepfe hier sind jetzt dasselbe Bauteil (.up-ph-iconbtn, siehe core.css). Bei
            15px Zeichen ist 2 sichtbar schwerer. */
      var db = root.querySelector(".dph-docsbtn");
      if (db && !db.getAttribute("data-dph-iconly")){
        db.setAttribute("data-dph-iconly", "1");
        db.classList.add("up-ph-iconbtn");
        db.setAttribute("aria-label", "Open Documentation");
        db.innerHTML = UC.icon ? UC.icon("libraryBig", 1.8) : db.innerHTML;
      }

      /* 3. Das Refresh-Zeichen aus core statt als Inline-Kopie im Markup. Es IST bereits Lucide
            refresh-cw und Pfad fuer Pfad dasselbe wie UC.icon("refreshCw") -- nachgeprueft gegen
            lucide-static. Genau darum kommt es jetzt von dort: eine Form, die zweimal im Repo
            steht, ist die naechste, die auseinanderlaeuft. Groesse und Strichstaerke aendern sich
            nicht mehr aus dem Markup, sondern aus dem Bauteil (.up-ph-iconbtn svg { 15px }),
            und die Strichstaerke ist 1.8 wie bei seinen zwei Nachbarn. */
      var rb = root.querySelector(".dph-refreshbtn");
      if (rb && UC.icon && !rb.getAttribute("data-dph-ic")){
        rb.setAttribute("data-dph-ic", "1");
        rb.innerHTML = UC.icon("refreshCw", 1.8);
      }

      /* 4. Der Suchknopf ZWISCHEN den beiden. Er oeffnet die Palette (Quick Actions) -- und zwar
            direkt: window.MiraQuickActions.open() ist ihr oeffentlicher Weg, den die Palette
            selbst anbietet. Damit braucht dieser Knopf KEINEN Bubble-Workflow. Wer trotzdem einen
            will (etwa um vorher etwas zu laden), setzt data-search-fn -- dann geht zusaetzlich ein
            Ereignis heraus. Ohne Attribut geht keines, sonst stuende bei jedem Klick eine Warnung
            in der Konsole ueber einen Workflow, den niemand haben wollte.
            Eingebaut wird er hier und nicht in der Vorlage: bubble/*.html erreicht ein bestehendes
            Element nicht mehr, und dieser Knopf soll mit dem Pin ankommen. */
      var tools = root.querySelector(".dph-tools");
      if (tools && !tools.querySelector(".dph-searchbtn")){
        var sb = document.createElement("button");
        sb.className = "dph-searchbtn up-ph-iconbtn";
        sb.type = "button";
        sb.setAttribute("aria-label", "Open Quick Actions");
        sb.setAttribute("data-tip", "Quick Actions");
        sb.innerHTML = UC.icon ? UC.icon("search", 1.8) : "";
        /* Zwischen Docs und Refresh: vor dem Refresh-Knopf, wenn es einen gibt, sonst ans Ende. */
        if (rb) tools.insertBefore(sb, rb); else tools.appendChild(sb);
      }
    })();

    var searchBtn = root.querySelector(".dph-searchbtn");
    if (searchBtn){
      searchBtn.addEventListener("click", function(){
        /* Der Knopf DRUECKT Cmd+K (bzw. Strg+K) -- er ruft nicht die Palette auf. Der Unterschied
           ist kein Geschmack: auf Cmd+K hoert quick-actions.js schon selbst (keydown am Dokument,
           Capture-Phase), und dort steht auch, dass ein zweiter Druck wieder schliesst. Wer
           stattdessen deren open() ruft, baut eine zweite Stelle, die entscheidet, was "Suche
           oeffnen" heisst -- und die laeuft beim naechsten Mal auseinander.
           Gesendet wird am FOKUSSIERTEN Element (nach dem Klick ist das dieser Knopf), nicht am
           Dokument: so laeuft das Ereignis die Capture-Phase durch das Dokument, wie ein echter
           Tastendruck. */
        var mac = false;
        try { mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || ""); } catch(e){}
        var genommen = false;
        try {
          var ev = new KeyboardEvent("keydown", { key: "k", code: "KeyK",
            metaKey: mac, ctrlKey: !mac, bubbles: true, cancelable: true });
          (document.activeElement || document.body).dispatchEvent(ev);
          /* preventDefault ist die Quittung: jemand hat den Druck genommen. */
          genommen = ev.defaultPrevented;
        } catch(e){}
        /* Hoert niemand auf Cmd+K (die Palette ist auf dieser Seite nicht eingebaut), bleibt der
           Weg nach Bubble -- dann ist die Warnung von UC.makeFire die richtige Auskunft: geklickt,
           nichts erreicht. Und wer zusaetzlich einen Workflow will, setzt data-search-fn. */
        if (root.getAttribute("data-search-fn") || !genommen) fire("data-search-fn", "dphSearch", {});
      });
    }

    var docsBtn = root.querySelector(".dph-docsbtn");
    if (docsBtn) docsBtn.addEventListener("click", function(){ fire("data-docs-fn", "dphDocs", {}); });

    var kpisEl = root.querySelector(".dph-kpis");
    var descEl = root.querySelector(".up-ph-desc");

    /* Mobile: the KPI strip is the thing that gives, not the description. Below some width the row
       no longer has room for .up-ph-left's full heading+description block AND the KPI strip side
       by side -- left, unlike the strip (flex:0 0 auto, fixed), can shrink and its text wraps, and
       without this the description started breaking onto a second line while the KPIs just sat
       there unbothered. Instead: try showing the KPIs, check whether the description NOW needs to
       wrap because of it, and if so hide them again -- freeing that width back to .up-ph-left. Runs
       on every resize tick (via UC.onResize below) and once right after setKpis() populates real
       content, since the KPI strip's width appearing at all is not itself a root resize. */
    /* 3. Die KPI-Leiste oben rechts ist aus. Sie bleibt im Markup und wird weiter gefuellt --
          setDashboardPageHeaderKpis ist ein bestehender Setter, und ein Aufruf, der ins Leere
          laeuft, waere eine stille Aenderung des Vertrags. Sichtbar ist sie nicht mehr
          (dashboard-page-header.css, .dph-kpis { display: none }).
          fitTopRight hat damit nichts mehr zu messen: es verglich die Hoehe der Beschreibung
          gegen die Breite der KPI-Leiste, um sie auf schmalen Seiten wieder wegzunehmen. Ohne
          sichtbare Leiste gibt es keinen Wettbewerb um die Breite -- und ein Zuhoerer, der bei
          jedem Resize eine Hoehe liest, ohne etwas zu entscheiden, ist genau der Posten, den die
          Performance-Runde ueberall abgebaut hat. */
    function fitTopRight(){}

    /* cls: "up-trend dph-trend-sm" keeps up-trend's pos/neg color logic (core.css) and just
       overrides icon/font size -- see dashboard-page-header.css's own comment on .dph-trend-sm for
       why a plain size override on .up-trend itself would have affected every OTHER trend chip in
       the app instead of just this one. */
    function kpiItem(label, valueText, delta, trendOpts){
      trendOpts = trendOpts || {};
      trendOpts.cls = "up-trend dph-trend-sm";
      var trend = UC.trendChip(delta, trendOpts);
      return '<span class="dph-kpi"><span class="dph-kpi-label">' + label + ':</span>' +
        '<span class="dph-kpi-value">' + valueText + '</span>' + trend + '</span>';
    }

    function setKpis(list){
      if (!kpisEl) return;
      var k = (list && list[0]) || null;
      if (!k){ kpisEl.innerHTML = ""; return; }
      /* Ranking is inverted (a LOWER rank is the improvement) and shown to 1 decimal, matching
         this app's existing rank convention (core.js's fmt1/rankCell) rather than the whole-number
         default the other two KPIs use -- avg_rank moves in increments too small to survive
         trendChip's default integer rounding (a real -0.35 move would round to 0 and vanish). */
      var vis = kpiItem("Visibility", fmtInt(k.avg_visibility_pct) + "%", k.avg_visibility_delta_pct, { suffix: "%" });
      var rank = kpiItem("Ranking", fmtRank(k.avg_rank), k.avg_rank_delta, { inverted: true, decimals: true });
      var sent = kpiItem("Sentiment", fmtInt(k.avg_sentiment), k.avg_sentiment_delta, {});
      kpisEl.innerHTML = vis + '<span class="dph-kpi-sep"></span>' + rank + '<span class="dph-kpi-sep"></span>' + sent;
      fitTopRight();
    }

    return { setKpis: setKpis };
  }

  dphBoot(30);
})();
