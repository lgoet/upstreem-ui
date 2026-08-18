/* upstreem topics-manager.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* Same boot-stub pattern as every other component: Bubble's own RunJS "kick" polling can call
     window.renderTopicsManager/setTopicsManagerLoading before core.js has finished loading and
     utmRun() has assigned the real functions — without this, that call throws and is lost. Stub
     them as immediate, synchronous queueing functions right away; utmRun() drains the queue (in
     original order) once the real implementations are assigned. */
  var __utmBootQueue = window.__utmBootQueue = window.__utmBootQueue || [];
  if (!window.__utmBootStubbed){
    window.__utmBootStubbed = true;
    ["renderTopicsManager", "setTopicsManagerLoading", "resetTopicsManager"].forEach(function(n){
      window[n] = function(){ __utmBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — topics-manager.js can start running before core.js
     has finished loading. Retry briefly instead of bailing forever on the first check. */
  function utmBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ utmBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    utmRun();
  }

  function utmRun(){
  var UC = window.UpstreemCore;
  var isYes = UC.isYes, esc = UC.esc, toNum = UC.toNum, fmtInt = UC.fmtInt, fmtTotal = UC.fmtTotal,
      parseBubbleJson = UC.parseBubbleJson, CHECK_SVG = UC.CHECK_SVG;

  /* Own store, deliberately NOT UC.STORE. Despite living in core, UC.STORE is hardcoded to
     window.__uutStore — urls-table's private key — and is keyed purely by data-instance. Sharing
     it meant a urls-table and a topics-manager that both sat at the default instance id
     overwrote each other: persist() here writes {query, sortField, sortDir}, wholesale replacing
     urls-table's 13-field entry (page, pageSize, filters, brands), and urls-table's query then
     surfaced in this component's search box on the next re-init. prompts-table and domains-table
     already declare their own for exactly this reason. */
  var STORE = (window.__utmStore = window.__utmStore || {});

  var SORT_FIELDS = [
    { key: "usage",   label: "Usage" },
    { key: "created", label: "Newest" },
    { key: "name",    label: "Name" }
  ];
  var DEFAULT_SORT = { field: "usage", dir: "desc" };

  var PLUS_SVG = UC.icon("plus", 1.8);

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    /* This page has no sticky header (no data-sticky-top concept), so it never calls
       UC.makeSticky — but the sort dropdown is still a plain position:absolute child that needs
       to escape any overflow:hidden Bubble container shorter than the menu itself. Unclip once,
       unconditionally, and never re-clip (unlike the sticky-header path, which only unclips while
       actually stuck) — this page's menus must never be cut off, full stop. */
    UC.unclipAncestors(root, false);

    var elHeadCount = root.querySelector(".up-head-count");
    var elHeading   = root.querySelector(".up-heading");
    var elHeadTools = root.querySelector(".up-head-tools");
    var elHead      = root.querySelector(".up-head");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elGrid      = root.querySelector(".utm-chipgrid");

    var state = {
      /* Aus dem Speicher zurueck, falls es diese Instanz schon einmal gab -- siehe persist(). */
      topics: Array.isArray(saved.topics) ? saved.topics : [],
      hasData: !!saved.hasData,
      loading: false, extLoading: false,
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field,
      sortDir: saved.sortDir || DEFAULT_SORT.dir
    };

    function persist(){
      /* Themen MIT in den Speicher, nicht nur die Ansichtsvorlieben. Bubble haengt das Element bei
         jedem Ansichtswechsel neu ein; der frische Controller startet dann ohne Daten und zeigt
         Skelette, bis jemand renderTopicsManager erneut ruft -- und wenn die Seite nicht neu
         geladen wurde, ruft das niemand. Gemeldet als: nach Navigation und Themenwechsel steht die
         Tabelle im Dauerladen, und die Custom Groupings zeigen "Deleted topic", weil ihre Themen-Ids
         gegen eine leere Liste aufgeloest werden.
         Dieselbe Bauart wie __usnStore in der Sidebar, aus demselben Grund. */
      STORE[instanceId] = { query: state.query, sortField: state.sortField, sortDir: state.sortDir,
                            topics: state.topics, hasData: state.hasData };
    }
    function isBusy(){ return !!state.loading || !!state.extLoading; }

    function usableAttr(v, placeholder){ return v != null && v !== "" && v !== placeholder; }
    function hasProcessingAttr(){
      return usableAttr(root.getAttribute("data-processing"), "IS_PROCESSING") ||
             usableAttr(root.getAttribute("data-processing2"), "IS_PROCESSING_2");
    }
    function readProcessing(){
      var a = root.getAttribute("data-processing"), b = root.getAttribute("data-processing2");
      var pa = usableAttr(a, "IS_PROCESSING") ? isYes(a) : false;
      var pb = usableAttr(b, "IS_PROCESSING_2") ? isYes(b) : false;
      return pa || pb;
    }

    var fire = UC.makeFire(root, { label: "topics-manager", eventPrefix: "utm-" });

    /* ---------------- client-side search + sort ----------------
       Bounded list, no server round-trip for any of this (unlike the paginated tables) — same
       precedent as prompts-table.js's own bulk topic editor, which already filters its full
       state.topics array locally. Only Add/Edit/Delete ever talk to Bubble. */
    function topicsShown(){
      var q = state.query.trim().toLowerCase();
      var list = state.topics;
      if (q) list = list.filter(function(t){ return String(t.name || "").toLowerCase().indexOf(q) >= 0; });
      list = list.slice().sort(function(a, b){
        var av, bv;
        if (state.sortField === "usage"){ av = toNum(a.prompt_count) || 0; bv = toNum(b.prompt_count) || 0; }
        else if (state.sortField === "created"){ av = String(a.created_at || ""); bv = String(b.created_at || ""); }
        else { av = String(a.name || "").toLowerCase(); bv = String(b.name || "").toLowerCase(); }
        if (av < bv) return state.sortDir === "asc" ? -1 : 1;
        if (av > bv) return state.sortDir === "asc" ? 1 : -1;
        return 0;
      });
      return list;
    }

    function renderCount(){
      elHeading.classList.add("has-count");
      /* Skeleton for the WHOLE duration of isBusy(), not just before the first load — same fix
         as every other component this session. */
      if (isBusy()){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      if (!state.hasData){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = fmtTotal(state.topics.length);
      elHeadCount.classList.remove("is-sk");
    }

    function chipHtml(t){
      var id = String(t.id);
      var color = String(t.hex_light || t.hex_dark || "#6b7280");
      if (color.charAt(0) !== "#") color = "#" + color;
      return '<button type="button" class="utm-topicchip up-chiphover" data-topic-id="' + esc(id) +
        '" style="--ust-tag-color:' + esc(color) + '">' +
        (t.emoji ? '<span class="utm-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
        '<span class="utm-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
        '<span class="utm-topicchip-count">' + fmtInt(toNum(t.prompt_count) || 0) + '</span>' +
        '</button>';
    }
    /* Fixed-width skeleton pills of varying width purely for visual rhythm — no data to reflect
       yet, so nothing here is measured off real content. */
    var SK_WIDTHS = [96, 132, 84, 150, 108, 90, 168, 120, 100, 140];
    function skeletonChipsHtml(){
      return SK_WIDTHS.map(function(w){ return '<span class="utm-topicchip up-tsk" style="width:' + w + 'px"></span>'; }).join("");
    }
    function renderChips(){
      if (!elGrid) return;
      if (isBusy() || !state.hasData){ elGrid.innerHTML = skeletonChipsHtml(); return; }
      var shown = topicsShown();
      if (!shown.length){
        elGrid.innerHTML = '<div class="utm-empty">' + (state.query ? "No topics match your search." : "No topics yet.") + '</div>';
        return;
      }
      elGrid.innerHTML = shown.map(chipHtml).join("");
    }

    /* ==================== Custom Groupings ====================================================
       Eine Gruppierung ist eine benannte Kombination aus bis zu drei Themen -- ein Prompt zaehlt
       dazu, wenn er ALLE traegt. Es ist dieselbe Sache, die das Gruppierungs-Dropdown der
       prompts-table verwaltet, und sie liegt im SELBEN Speicher (UC.cgRead/cgWrite, teambezogen):
       was hier entsteht, steht dort sofort im Dropdown und umgekehrt.
       Geteilt sind ausserdem das Anlegen-Fenster (UC.makeGroupingModal), die Zeilenbausteine
       (UC.cgDotHtml/cgEyeHtml/cgMoreHtml) und das Umsortieren (UC.cgDragList). Hier steht nur, was
       diesen Ort ausmacht: eine Uebersicht in Listenform statt einer Zeile im Popover, mit den
       Themen als Chips daneben.

       Der Abschnitt wird per JS gebaut und nicht ins Bubble-Markup gelegt: bubble/*.html ist eine
       Vorlage fuer Neuinstallationen, ein bestehendes Element bekommt daraus nichts. Waere er nur
       dort, muesste jede Platzierung von Hand nachgezogen werden. */
    var CG_MENU = null;     /* Schluessel der Zeile, deren Dreipunktmenue offen ist */
    var elCg = null, elCgList = null, elCgCount = null;

    function cgAufbauen(){
      if (!elGrid || !elGrid.parentNode) return;
      elCg = root.querySelector(".utm-cg");
      if (!elCg){
        elCg = document.createElement("div");
        elCg.className = "utm-cg";
        elCg.innerHTML =
          '<div class="up-head utm-cg-head">' +
            '<div class="up-heading has-count">' +
              '<span class="up-head-label">Custom Groupings</span>' +
              '<span class="up-head-sep"></span>' +
              '<span class="up-head-count utm-cg-count"></span>' +
            '</div>' +
            '<div class="up-head-tools">' +
              '<button class="up-export utm-cg-addbtn" type="button" data-cg-new>' +
                UC.icon("plus", 1.8) + '<span>New Grouping</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
          /* up-cg-list: daran haengen die Regeln fuer den Zieh-Zustand (Greifhand, keine
             Textauswahl), dieselben wie an der Liste im Dropdown. */
          '<div class="utm-cg-list up-cg-list"></div>';
        /* Direkt unter der Themenliste, wie bestellt. */
        elGrid.parentNode.insertBefore(elCg, elGrid.nextSibling);
      }
      elCgList = elCg.querySelector(".utm-cg-list");
      elCgCount = elCg.querySelector(".utm-cg-count");
      /* Das Ziehen haengt an der LISTE, nicht an den Zeilen: die Liste ueberlebt jedes
         Neuzeichnen, weil nur ihr innerHTML getauscht wird. */
      UC.cgDragList(elCgList, {
        rowSel: "[data-grp-drag]",
        noDragSel: ".up-cg-eye, .up-cg-more, .up-cg-rowmenu",
        onOrder: function(keys){ UC.cgApplyOrder(keys); },
        onDrop: function(){ renderCg(); }
      });
    }

    /* Die Themen einer Gruppierung als Chips -- dasselbe .up-topicchip, das die Auswahl im
       Fenster zeigt, nur ohne Haken und ohne Klickflaeche: hier ist es Anzeige, keine Wahl.
       Ein Thema, das es nicht mehr gibt (geloescht, nachdem die Gruppierung entstand), wird als
       solches benannt statt stillschweigend zu fehlen -- sonst zeigt eine Gruppe aus drei Themen
       plotzlich zwei Chips und sieht wie ein Fehler aus. */
    function cgChipsHtml(g){
      return (g.tag_ids || []).map(function(id){
        var t = null;
        for (var i = 0; i < state.topics.length; i++){
          if (String(state.topics[i].id) === String(id)){ t = state.topics[i]; break; }
        }
        if (!t){
          return '<span class="up-topicchip utm-cg-chip is-gone" title="This topic no longer exists">' +
            '<span class="up-topicchip-lbl">Deleted topic</span></span>';
        }
        var color = String(t.hex_light || t.hex_dark || "#6b7280");
        if (color.charAt(0) !== "#") color = "#" + color;
        return '<span class="up-topicchip utm-cg-chip" style="--ust-tag-color:' + esc(color) + '">' +
          (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
          '<span class="up-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
        '</span>';
      }).join("");
    }

    function cgRowHtml(g){
      var aus = !!g.hidden;
      /* up-cg-row ist die KIT-Klasse: an ihr haengen in core.css die Regeln, die vom Zustand der
         Zeile abhaengen -- Hover deckt Auge und Kebab auf, das Ziehen macht die Zeile zum
         Platzhalter. Ohne sie blieben die Aktionen unsichtbar; genau das war beim ersten Durchlauf
         der Fall. is-draggable gibt die Greifhand, wie im Dropdown der Tabelle. */
      return '<div class="utm-cg-row up-cg-row' + (aus ? " is-hidden" : " is-draggable") +
          (CG_MENU === g.key ? " is-menuopen" : "") + '"' +
          /* Verborgene Gruppierungen tragen kein data-grp-drag: etwas umzusortieren, das man
             gerade nicht sieht, ist ein Ergebnis, das man erst spaeter bemerkt. */
          (aus ? "" : ' data-grp-drag="' + esc(g.key) + '"') + '>' +
        UC.cgDotHtml(g.color) +
        '<span class="utm-cg-name">' + esc(g.key) + '</span>' +
        '<span class="utm-cg-chips">' + cgChipsHtml(g) + '</span>' +
        '<span class="utm-cg-actions">' + UC.cgEyeHtml(g) + UC.cgMoreHtml(g, CG_MENU) + '</span>' +
        /* Nur ueber .is-dragging sichtbar: der graue Platzhalter fuer die gezogene Zeile. Steht im
           Markup statt beim Ziehen erzeugt zu werden -- ein Element, das mitten in einer
           Zeigerbewegung entsteht, kostet einen Layoutdurchgang im falschen Moment. */
        '<span class="utm-cg-sk-dot up-cg-sk-dot"></span>' +
        '<span class="utm-cg-sk-text up-cg-sk-text"></span>' +
      '</div>';
    }

    function renderCg(){
      if (!elCgList) return;
      var liste = UC.cgRead();
      /* Verborgene nach unten, sichtbare in ihrer gespeicherten Reihenfolge -- dieselbe Sortierung
         wie im Dropdown der prompts-table. */
      var sichtbar = liste.filter(function(g){ return !g.hidden; });
      var verborgen = liste.filter(function(g){ return g.hidden; });
      var alle = sichtbar.concat(verborgen);
      if (elCgCount) elCgCount.textContent = alle.length ? String(alle.length) : "";
      if (!alle.length){
        elCgList.innerHTML = '<div class="utm-cg-empty">' +
          '<span class="utm-cg-empty-t">No custom groupings yet</span>' +
          '<span class="utm-cg-empty-s">Combine up to ' + UC.CG_MAX_TOPICS +
            ' topics into one group. A prompt counts towards it only if it carries all of them.</span>' +
          '</div>';
        return;
      }
      elCgList.innerHTML = alle.map(cgRowHtml).join("");
    }

    var cgModal = UC.makeGroupingModal({
      getIsDark: function(){ return isDark; },
      getTopics: function(){ return state.topics || []; },
      topicId: function(t){ return String(t && t.id); },
      onSave: function(){ renderCg(); }
    });

    /* ---------------- sort dropdown ---------------- */
    var sortPop = elSort ? UC.makePopover({ wrap: elSort, menu: elSortMenu, opener: elSort.querySelector(".up-sort-btn"), group: "utm-" + instanceId }) : null;
    function populateSort(){
      if (!elSortMenu) return;
      /* Shared markup: UC.sortMenuHtml. Four components built this string identically, including
         the data-sortfield / data-sortdir hooks their click handlers match on -- so a change to
         the markup here had to be made in four places or the handlers drifted apart from it. */
      elSortMenu.innerHTML = UC.sortMenuHtml(SORT_FIELDS, state.sortField, state.sortDir);
    }
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      persist(); populateSort(); renderChips();
    }

    /* ---------------- search ----------------
       Only search's open/close + mobile takeover come from UC.makeSearch — the actual filtering
       is local and instant, so it deliberately does NOT go through makeSearch's debounced
       run()/onFire() chain (that chain sets state.loading=true, which is right for a server round
       trip and wrong here — it would flash the head-count skeleton on every keystroke). */
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      prefix: "utm", mobileMax: 640,
      onRender: function(){}, onFire: function(){ renderChips(); }, persist: persist,
      onTakeoverEnd: function(){ applyResponsive(); }
    });
    var searchDebounce = null;
    if (elSearchIn){
      elSearchIn.addEventListener("input", function(){
        state.query = String(elSearchIn.value || "").trim();
        elSearch.classList.toggle("has-text", !!elSearchIn.value.length);
        persist();
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(renderChips, 150);
      });
    }

    /* ==================== modal: add / edit / delete ====================
       Shared with prompts-table's "Add Topic" button — see UC.makeTopicModal in core.js for the
       actual implementation and why it's built as onSave/onDelete callbacks rather than firing
       Bubble events itself. */
    var topicModal = UC.makeTopicModal({
      getIsDark: function(){ return isDark; },
      onSave: function(payload, mode, topic){
        if (mode === "edit" && topic) payload.id = String(topic.id);
        fire(mode === "edit" ? "data-edit-fn" : "data-add-fn",
             mode === "edit" ? "bubble_fn_utmEdit" : "bubble_fn_utmAdd", payload);
        /* No topicsChanged() here -- see topics-filter.js for the full reasoning. In short: firing
           a refresh straight after the mutation event RACES Bubble's own workflow. The refresh
           reads the database before the write has committed and comes back with data that is one
           step behind. Only Bubble knows when its write is done, so the refresh belongs at the END
           of the workflow that performs it. */
      },
      onDelete: function(topic){
        fire("data-delete-fn", "bubble_fn_utmDelete", { id: String(topic.id) });
        /* No topicsChanged() here -- see topics-filter.js for the full reasoning. In short: firing
           a refresh straight after the mutation event RACES Bubble's own workflow. The refresh
           reads the database before the write has committed and comes back with data that is one
           step behind. Only Bubble knows when its write is done, so the refresh belongs at the END
           of the workflow that performs it. */
      }
    });

    /* ---------------- toolbar fit (mobile) ----------------
       Same mechanism as urls-table/domains-table/prompts-table: measure the actual gap between
       the heading and the tools row, drop one tier at a time until it fits. Only two tiers needed
       here — this topbar has just Add/Search/Sort, no brand-toggle/mentioned-dropdown/cols-menu.
       is-w1 hides Sort (core.css, generic). is-w0 shrinks Add-Topic to icon-only — reusing the
       SAME generic rule core.css already has for .up-export (`.is-w0 .up-export span{display:none}`),
       since the Add button just IS a .up-export under the hood. */
    var SEARCH_OPEN_WIDTH = 202;
    var MIN_HEAD_GAP = 64;
    var TOOLBAR_TIERS = ["is-w1", "is-w0"];
    /* Shared: UC.headGap. Five components measured this identically (urls-table differed only in
       two comments). */
    function headGap(){ return UC.headGap(elHeading, elHeadTools, elSearch, SEARCH_OPEN_WIDTH); }
    function fitToolbar(){
      if (!elHeading || !elHeadTools) return;
      if (root.classList.contains("is-searchtakeover")) return;
      for (var r = 0; r < TOOLBAR_TIERS.length; r++) root.classList.remove(TOOLBAR_TIERS[r]);
      for (var i = 0; i < TOOLBAR_TIERS.length; i++){
        if (headGap() >= MIN_HEAD_GAP) return;
        root.classList.add(TOOLBAR_TIERS[i]);
      }
    }
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      search.syncTakeover();
      fitToolbar();
      root.classList.toggle("is-vnarrow", w < 620);
    }
    /* Fallback when core.js is OLDER than this file.
       core.js is a single global (window.UpstreemCore) shared by every component on the page, but
       each component loads it via its OWN data-cdn-pin — so a page with mixed pins ends up with
       whichever core.js executed last. Calling a function a stale core does not have throws
       inside initRoot, which aborts the whole component: no controller is stored, so render* and
       reset* silently do nothing afterwards. Degrading here instead keeps the component alive on
       a mixed page; only the newer behaviour is missing. */
    function onResizeCompat(el, fn){
      if (UC.onResize) return UC.onResize(el, fn);
      if (window.ResizeObserver){
        var raf = null;
        new ResizeObserver(function(){
          if (raf) return;
          raf = requestAnimationFrame(function(){ raf = null; fn(); });
        }).observe(el);
      } else {
        window.addEventListener("resize", UC.rafThrottle(fn));
      }
    }
    /* One coalesced responsive pass per frame (core). The old pairing of a
       ResizeObserver AND a window-resize listener ran the whole measure/drop cascade
       TWICE per frame while a window was being dragged, and each pass forces several
       synchronous reflows. onResize also skips frames where the width did not change. */
    onResizeCompat(root, applyResponsive);

    /* ---------------- click delegation ----------------
       On document, not root — deliberately. UC.makePopover's own outside-click listener is also
       document-level and (for the FIRST popover ever created on the page) registers before this
       one, so bubble-phase document listeners run in that order: makePopover's "is this click
       still inside the wrap" check first, then this handler's DOM rebuild second. Attaching this
       directly to root would run it during the bubble phase BEFORE it ever reaches document —
       i.e. before makePopover's check — so by the time that check ran, populateSort()'s
       innerHTML rebuild would already have detached the very node the user clicked, and
       wrap.contains(e.target) would read false: exactly the same "e.target went stale mid-bubble"
       trap prompts-table.js's bulk-bar comment already documents for a different case. Confirmed
       live: clicking a sort option closed the dropdown it just changed until this moved to
       document. */
    document.addEventListener("click", function(e){
      if (!root.contains(e.target)) return;   // elSortMenu is a plain child of root, not portaled (STYLEGUIDE §14)
      if (e.target.closest("[data-topic-add-new]")){ topicModal.open("create", null); return; }
      /* ---- Custom Groupings ----
         Der Reihenfolge nach: erst die Knoepfe IN der Zeile, dann die Zeile selbst. Umgekehrt
         schluckte ein Klick auf das Auge die Zeilenaktion. */
      if (e.target.closest("[data-cg-new]")){ CG_MENU = null; renderCg(); cgModal.open(null); return; }
      var cgEye = e.target.closest("[data-grp-eye]");
      if (cgEye){
        UC.cgSetHidden(cgEye.getAttribute("data-grp-eye"));
        CG_MENU = null; renderCg(); return;
      }
      var cgMore = e.target.closest("[data-grp-rowmenu]");
      if (cgMore){
        var mk = cgMore.getAttribute("data-grp-rowmenu");
        CG_MENU = (CG_MENU === mk) ? null : mk;
        renderCg(); return;
      }
      var cgEdit = e.target.closest("[data-grp-edit]");
      if (cgEdit){
        var edk = cgEdit.getAttribute("data-grp-edit");
        var eintrag = UC.cgFind(edk);
        CG_MENU = null; renderCg();
        if (eintrag) cgModal.open(eintrag);
        return;
      }
      var cgDel = e.target.closest("[data-grp-del]");
      if (cgDel){
        var dk = cgDel.getAttribute("data-grp-del");
        UC.cgDelete(dk);
        CG_MENU = null; renderCg(); return;
      }
      /* Klick irgendwo sonst im Abschnitt schliesst ein offenes Zeilenmenue -- dasselbe Verhalten
         wie bei jedem Dropdown der App. */
      if (CG_MENU && elCg && elCg.contains(e.target)){ CG_MENU = null; renderCg(); }
      if (e.target.closest(".up-search-btn")){ search.toggle(); return; }
      if (e.target.closest(".up-search-clear")){
        elSearchIn.value = ""; state.query = ""; elSearch.classList.remove("has-text");
        persist(); renderChips();
        try { elSearchIn.focus(); } catch(e2){}
        return;
      }
      if (e.target.closest(".up-sort-btn")){ if (sortPop) sortPop.toggle(); return; }
      var sf = e.target.closest("[data-sortfield]");
      if (sf){ applySort(sf.getAttribute("data-sortfield"), state.sortDir); return; }
      if (e.target.closest("[data-sortdir]")){ applySort(state.sortField, state.sortDir === "desc" ? "asc" : "desc"); return; }
      var chip = e.target.closest(".utm-topicchip");
      if (chip && elGrid && elGrid.contains(chip)){
        var tid = chip.getAttribute("data-topic-id");
        var topic = null;
        for (var i = 0; i < state.topics.length; i++){ if (String(state.topics[i].id) === tid){ topic = state.topics[i]; break; } }
        if (topic) topicModal.open("edit", topic);
      }
    });

    /* ---------------- external loading / theme attrs ---------------- */
    var explicitOverride = false;
    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" + String(root.getAttribute("data-processing2") || "");
    function syncFromAttrs(muts){
      /* Shared: UC.syncTheme applies data-isdark to data-theme and reports whether it moved.
         Five components had these seven lines character for character. */
      var _th = UC.syncTheme(root, isDark);
      isDark = _th.isDark;
      var changed = _th.changed;
      /* Reiner Themewechsel: Ladezustand nicht anfassen. Siehe UC.themeOnly. */
      if (UC.themeOnly && UC.themeOnly(muts)){ if (changed) render(); return; }
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" + String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){ lastProcAttr = procAttr; explicitOverride = false; }
      if (!explicitOverride){
        var wantProc = readProcessing();
        if (wantProc !== state.extLoading){ state.extLoading = wantProc; changed = true; }
      }
      if (changed) render();
    }
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark","data-processing","data-processing2"]
    });
    syncFromAttrs();

    function render(){
      renderCount();
      renderChips();
      cgAufbauen();
      renderCg();
      populateSort();
      applyResponsive();
    }
    render();

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          /* NICHT isYes(params.isDark): der Parameter ist eine Momentaufnahme aus dem Moment,
             in dem Bubble den Payload gebaut hat. Kennt core ein Thema, gewinnt core -- sonst
             dreht ein Render-Aufruf mit altem is_dark die Komponente hinter der App zurueck.
             Siehe UC.themeParam. */
          isDark = UC.themeParam(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        }
        if (params.topics != null){
          var list = params.topics;
          if (typeof list === "string") list = parseBubbleJson(list);
          state.topics = Array.isArray(list) ? list : [];
          state.hasData = true;
          state.loading = false;
          /* Themen sind die Antwort, auf die JEDER Ladezustand gewartet hat -- auch der
             ausdrueckliche. Sonst dreht die Liste nach einem setLoading("yes") ohne passendes "no"
             weiter, obwohl die Daten dastehen. Dieselbe Stelle wie in den vier Tabellen. */
          state.extLoading = false;
          persist();
        }
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        /* A round trip just came back — if the modal was waiting on THIS one, it's done. */
        if (topicModal.isOpen() && topicModal.isSaving()) topicModal.close();
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        state.extLoading = isYes(on);
        if (!state.extLoading) state.loading = false;
        render();
      },
      reset: function(){
        state.query = ""; if (elSearchIn) elSearchIn.value = ""; if (elSearch) elSearch.classList.remove("is-open", "has-text");
        state.sortField = DEFAULT_SORT.field; state.sortDir = DEFAULT_SORT.dir;
        topicModal.close();
        persist(); populateSort(); render();
        return true;
      },
      destroy: function(){
        topicModal.destroy();
        if (root.__utmController === this) root.__utmController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__utmController) return root.__utmController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__utmController = ctrl;
    return ctrl;
  }

  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "utm-root", notPortal: true,
    ctrlProp: "__utmController",
    resolveLocal: "__utmResolveLocal",
    queue: "__utmBootQueue",
    initRoot: initRoot,
    api: { renderTopicsManager: doRender, setTopicsManagerLoading: doLoading, resetTopicsManager: doReset },
    forwardShape: { renderTopicsManager: "params", resetTopicsManager: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }
  function doRender(params){
    var id = params && params.instanceId;
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".utm-root"));
    if (!ctrl){
      var have = Array.prototype.map.call(document.querySelectorAll(".utm-root"), function(r){
        return r.getAttribute("data-instance") || "(none)";
      });
      if (window.console) console.warn("[topics-manager] renderTopicsManager: no matching .utm-root for instanceId " +
        JSON.stringify(id) + ". Roots on this page have data-instance: " + JSON.stringify(have));
      return false;
    }
    ctrl.update(params);
    return true;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }

  } // end utmRun

  utmBoot(50); // retry for ~5s before giving up on core.js
})();
