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

  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

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
      topics: [],
      hasData: false,
      loading: false, extLoading: false,
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field,
      sortDir: saved.sortDir || DEFAULT_SORT.dir
    };

    function persist(){
      STORE[instanceId] = { query: state.query, sortField: state.sortField, sortDir: state.sortDir };
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
    function headGap(){
      var h = elHeading && elHeading.getBoundingClientRect();
      var tl = elHeadTools && elHeadTools.getBoundingClientRect();
      if (!h || !tl || !tl.width) return Infinity;
      var gap = tl.left - h.right;
      if (elSearch && !elSearch.classList.contains("is-open")) gap -= SEARCH_OPEN_WIDTH;
      return gap;
    }
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
    function syncFromAttrs(){
      /* Shared: UC.syncTheme applies data-isdark to data-theme and reports whether it moved.
         Five components had these seven lines character for character. */
      var _th = UC.syncTheme(root, isDark);
      isDark = _th.isDark;
      var changed = _th.changed;
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
      populateSort();
      applyResponsive();
    }
    render();

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        }
        if (params.topics != null){
          var list = params.topics;
          if (typeof list === "string") list = parseBubbleJson(list);
          state.topics = Array.isArray(list) ? list : [];
          state.hasData = true;
          state.loading = false;
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
