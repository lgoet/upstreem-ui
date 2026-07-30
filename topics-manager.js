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
      parseBubbleJson = UC.parseBubbleJson, CHECK_SVG = UC.CHECK_SVG, STORE = UC.STORE;

  var SORT_FIELDS = [
    { key: "usage",   label: "Usage" },
    { key: "created", label: "Newest" },
    { key: "name",    label: "Name" }
  ];
  var DEFAULT_SORT = { field: "usage", dir: "desc" };

  var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var SMILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';

  /* ---- topic color palette + emoji library — verbatim port from prompts-table.js's bulk topic
     editor (duplicated, not shared via core, per STYLEGUIDE §25's own "extract after real
     duplication, not before" philosophy — this is the second consumer, not yet worth extracting).
     Rows are tone bands (vibrant/muted/deep), columns are hues — scanning down picks a mood,
     across picks a color. Only hex_light is ever rendered (see chipHtml), so these are tuned to
     read acceptably in BOTH themes at once rather than getting a per-theme pass. */
  var TOPIC_COLOR_COLS = 10;   // must match .utm-colorgrid's column count
  var TOPIC_COLOR_PALETTE = [
    /* vibrant */ "#de1b22", "#b65616", "#8d6a11", "#108440", "#107c84", "#1b6eda", "#9145e8", "#d51a8b", "#666666", "#7d7d7d",
    /* muted   */ "#b47476", "#a87b5d", "#988552", "#4f926b", "#509195", "#6a88af", "#977ab8", "#b27098", "#787878", "#949494",
    /* deep    */ "#ab2b2f", "#8b4c23", "#725a1d", "#1b6a3c", "#1b656a", "#295ea3", "#7a33cc", "#a32972", "#575757", "#666666"
  ];
  function swatchInk(hex){
    var h = String(hex).replace("#", "");
    function lin(c){ c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var y = 0.2126 * lin(h.slice(0,2)) + 0.7152 * lin(h.slice(2,4)) + 0.0722 * lin(h.slice(4,6));
    return y > 0.179 ? "#151515" : "#ffffff";
  }
  var EMOJI_LIB_URL = "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";
  var emojiLibPromise = null;
  function ensureEmojiLib(){
    if (window.customElements && window.customElements.get("emoji-picker")) return;
    if (emojiLibPromise) return;
    emojiLibPromise = true;
    var s = document.createElement("script");
    s.type = "module";
    s.textContent = 'import "' + EMOJI_LIB_URL + '";';
    document.head.appendChild(s);
  }

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
      var html = '<div class="up-pop-head">Sort by</div>';
      html += SORT_FIELDS.map(function(f){
        return '<div class="up-pop-opt' + (f.key === state.sortField ? " is-active" : "") + '" data-sortfield="' + f.key + '">' +
                 '<span>' + esc(f.label) + '</span>' +
                 '<span class="up-check">' + CHECK_SVG + '</span>' +
               '</div>';
      }).join("");
      html += '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span>' +
          '<span class="up-switch' + (state.sortDir === "desc" ? " is-on" : "") + '" role="switch" data-sortdir></span>' +
        '</div>';
      elSortMenu.innerHTML = html;
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
       Body-mounted, one per controller/root (same scoping as prompts-table.js's own bulk-bar —
       .upt-bulkbar is declared inside makeController too, so each instance gets its own; two
       Topics Manager roots on one page never share or fight over a modal). Not routed through
       UC.makePopover: that primitive's open() closes every OTHER popover on the page, which is
       right for a corner dropdown but wrong for a true modal (opening a dropdown elsewhere must
       not silently close this). Instead this hand-rolls the exact same "blur focus before hiding"
       guard renderBulkBar()/setTopicMenuOpen() already use in prompts-table.js, plus its own
       Escape listener scoped to just this modal. */
    var modalBackdrop = null, modalOpenerEl = null;
    var modalMode = null;        // null | "create" | "edit"
    var modalTopic = null;
    var draftName = "", draftEmoji = "", draftColor = null;
    var pickOpen = null;         // null | "emoji" | "color"
    var modalSaving = false, modalSaveTimer = null;

    function pickerRowHtml(){
      var color = draftColor || TOPIC_COLOR_PALETTE[0];
      var emojiOpen = pickOpen === "emoji";
      var colorOpen = pickOpen === "color";
      var panel = "";
      if (emojiOpen){
        panel = '<div class="utm-pickpanel"><emoji-picker class="utm-emojipicker ' + (isDark ? "dark" : "light") + '"></emoji-picker></div>';
      } else if (colorOpen){
        panel = '<div class="utm-pickpanel"><div class="utm-colorgrid">' +
          TOPIC_COLOR_PALETTE.map(function(hx){
            var on = hx === color;
            return '<button type="button" class="utm-colorcell" data-color="' + esc(hx) + '"' +
              ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
              '<span class="utm-colorblob" style="background:' + esc(hx) +
                (on ? ";color:" + swatchInk(hx) : "") + '">' + (on ? CHECK_SVG : "") + '</span>' +
            '</button>';
          }).join("") +
        '</div></div>';
      }
      return '<div class="utm-approw">' +
          '<button type="button" class="utm-pickbtn' + (emojiOpen ? " is-open" : "") +
            '" data-pick="emoji" data-tip="Topic Emoji" aria-label="Topic emoji" aria-expanded="' + (emojiOpen ? "true" : "false") + '">' +
            (draftEmoji ? esc(draftEmoji) : SMILE_SVG) +
          '</button>' +
          '<button type="button" class="utm-pickbtn' + (colorOpen ? " is-open" : "") +
            '" data-pick="color" data-tip="Topic Color" aria-label="Topic color" aria-expanded="' + (colorOpen ? "true" : "false") + '">' +
            '<span class="utm-pickswatch" style="background:' + esc(color) + '"></span>' +
          '</button>' +
        '</div>' + panel;
    }
    function renderAppearance(){
      var wrap = modalBackdrop && modalBackdrop.querySelector(".utm-approw-wrap");
      if (wrap) wrap.innerHTML = pickerRowHtml();
    }
    function syncSaveEnabled(){
      var saveBtn = modalBackdrop && modalBackdrop.querySelector(".utm-modalsave");
      if (saveBtn) saveBtn.disabled = !draftName.trim();
    }

    function ensureModal(){
      if (modalBackdrop && document.body.contains(modalBackdrop)) return modalBackdrop;
      modalBackdrop = document.createElement("div");
      modalBackdrop.className = "utm-modalbackdrop";
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalBackdrop.innerHTML =
        '<div class="utm-modalcard" role="dialog" aria-modal="true" aria-labelledby="utm-modaltitle-' + esc(instanceId) + '">' +
          '<div class="utm-modalhead">' +
            '<div class="utm-modalheading">' +
              '<h2 class="utm-modaltitle" id="utm-modaltitle-' + esc(instanceId) + '"></h2>' +
            '</div>' +
            '<button type="button" class="utm-modalclose" data-modal-close aria-label="Close">' + CLOSE_SVG + '</button>' +
          '</div>' +
          '<div class="utm-modalbody">' +
            '<div class="utm-modalfield">' +
              '<label class="utm-modallabel">Name</label>' +
              '<input type="text" class="utm-modalname" maxlength="60" autocomplete="off" spellcheck="false"/>' +
            '</div>' +
            '<div class="utm-modalfield">' +
              '<label class="utm-modallabel">Appearance</label>' +
              '<div class="utm-approw-wrap"></div>' +
            '</div>' +
          '</div>' +
          '<div class="utm-modalfoot"></div>' +
        '</div>';

      var nameInput = modalBackdrop.querySelector(".utm-modalname");
      nameInput.addEventListener("input", function(){ draftName = nameInput.value; syncSaveEnabled(); });

      modalBackdrop.addEventListener("click", function(e){
        if (e.target === modalBackdrop){ closeModal(); return; }
        if (e.target.closest("[data-modal-close]")){ closeModal(); return; }
        if (e.target.closest("[data-modal-save]")){ saveModal(); return; }
        var delBtn = e.target.closest("[data-modal-delete]");
        if (delBtn){
          if (!deleteArmed()){
            modalBackdrop.querySelector(".utm-modaldelete").classList.add("is-armed");
            modalBackdrop.querySelector(".utm-modaldelete").textContent = "Confirm delete?";
            return;
          }
          fireDelete();
          return;
        }
        var pickBtn = e.target.closest("[data-pick]");
        if (pickBtn){
          var kind = pickBtn.getAttribute("data-pick");
          pickOpen = pickOpen === kind ? null : kind;
          if (pickOpen === "emoji") ensureEmojiLib();
          renderAppearance();
          return;
        }
        var colorBtn = e.target.closest("[data-color]");
        if (colorBtn){ draftColor = colorBtn.getAttribute("data-color"); renderAppearance(); return; }
      });
      /* emoji-picker-element dispatches this (bubbling, composed) from inside its shadow root. */
      modalBackdrop.addEventListener("emoji-click", function(e){
        var unicode = e.detail && e.detail.unicode;
        if (!unicode) return;
        draftEmoji = unicode;
        renderAppearance();   // deliberately does not close the picker — same reasoning as prompts-table.js
      });
      /* Scoped to just this modal, not core's page-global Escape (which closes every open
         popover) — a Topics Manager Escape must not, say, also close an unrelated sort menu
         open elsewhere on the page, nor should some other component's Escape reach in and
         close THIS modal. */
      document.addEventListener("keydown", function(e){
        if (!modalMode) return;
        if (e.key !== "Escape" && e.key !== "Esc") return;
        closeModal();
      });
      UC.makeTooltips(modalBackdrop, function(){ return isDark; });
      document.body.appendChild(modalBackdrop);
      return modalBackdrop;
    }
    function deleteArmed(){
      var b = modalBackdrop && modalBackdrop.querySelector(".utm-modaldelete");
      return !!(b && b.classList.contains("is-armed"));
    }
    function openModal(mode, topic){
      ensureModal();
      modalMode = mode; modalTopic = topic || null;
      draftName = topic ? String(topic.name || "") : "";
      draftEmoji = topic ? String(topic.emoji || "") : "";
      draftColor = topic ? String(topic.hex_light || topic.hex_dark || TOPIC_COLOR_PALETTE[0]) : TOPIC_COLOR_PALETTE[0];
      if (draftColor.charAt(0) !== "#") draftColor = "#" + draftColor;
      pickOpen = null; modalSaving = false;
      clearTimeout(modalSaveTimer);
      modalBackdrop.setAttribute("data-theme", isDark ? "dark" : "light");
      var titleEl = modalBackdrop.querySelector(".utm-modaltitle");
      if (titleEl) titleEl.textContent = mode === "create" ? "New Topic" : "Edit Topic";
      var nameInput = modalBackdrop.querySelector(".utm-modalname");
      if (nameInput) nameInput.value = draftName;
      var foot = modalBackdrop.querySelector(".utm-modalfoot");
      if (foot){
        foot.innerHTML = (mode === "edit"
          ? '<button type="button" class="utm-modaldelete" data-modal-delete>Delete</button>'
          : "") +
          '<button type="button" class="utm-modalsave" data-modal-save' + (draftName.trim() ? "" : " disabled") + '>Save</button>';
      }
      renderAppearance();
      modalOpenerEl = document.activeElement;
      modalBackdrop.setAttribute("aria-hidden", "false");
      void modalBackdrop.offsetWidth;   // force layout flush so the appear transition actually runs
      modalBackdrop.classList.add("is-shown");
      setTimeout(function(){ try { nameInput.focus(); nameInput.select(); } catch(e){} }, 60);
    }
    function closeModal(){
      if (!modalBackdrop || !modalMode) return;
      /* Blur focus BEFORE hiding: aria-hidden on an ancestor of the focused element is an
         accessibility trap, and Chrome refuses it outright with a console error — same fix as
         renderBulkBar()/setTopicMenuOpen() in prompts-table.js. */
      if (modalBackdrop.contains(document.activeElement)){
        try { document.activeElement.blur(); } catch(e){}
      }
      modalBackdrop.classList.remove("is-shown");
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalMode = null; modalTopic = null;
      clearTimeout(modalSaveTimer); modalSaving = false;
      try { if (modalOpenerEl && modalOpenerEl.focus) modalOpenerEl.focus(); } catch(e){}
      modalOpenerEl = null;
    }
    function saveModal(){
      var name = draftName.trim();
      if (!name || modalSaving) return;
      var payload = { name: name, emoji: draftEmoji || "", hex_light: draftColor || TOPIC_COLOR_PALETTE[0], hex_dark: draftColor || TOPIC_COLOR_PALETTE[0] };
      if (modalMode === "edit" && modalTopic) payload.id = String(modalTopic.id);
      modalSaving = true;
      var saveBtn = modalBackdrop.querySelector(".utm-modalsave");
      if (saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = ".6"; }
      fire(modalMode === "edit" ? "data-edit-fn" : "data-add-fn",
           modalMode === "edit" ? "bubble_fn_utmEdit" : "bubble_fn_utmAdd", payload);
      /* Nothing else in this library waits mid-interaction on a round trip — every table's
         search/sort/filter updates the local view optimistically and never blocks a control on
         the response. A mutation genuinely has to wait for Bubble's RPC before the modal can
         close (there's no optimistic id to show yet on create), so this is the one place with a
         "saving" state — with a generous timeout so a dropped/failed RPC can't trap the user in
         a stuck modal forever. */
      clearTimeout(modalSaveTimer);
      modalSaveTimer = setTimeout(function(){
        modalSaving = false;
        if (saveBtn){ saveBtn.disabled = !draftName.trim(); saveBtn.style.opacity = ""; }
      }, 8000);
    }
    function fireDelete(){
      if (!modalTopic) return;
      fire("data-delete-fn", "bubble_fn_utmDelete", { id: String(modalTopic.id) });
      closeModal();
    }

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
    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__utmRaf) return;
        root.__utmRaf = requestAnimationFrame(function(){ root.__utmRaf = null; applyResponsive(); });
      }).observe(root);
    }
    window.addEventListener("resize", applyResponsive);

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
      if (e.target.closest("[data-topic-add-new]")){ openModal("create", null); return; }
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
        if (topic) openModal("edit", topic);
      }
    });

    /* ---------------- external loading / theme attrs ---------------- */
    var explicitOverride = false;
    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" + String(root.getAttribute("data-processing2") || "");
    function syncFromAttrs(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        changed = true;
      }
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
        if (modalMode && modalSaving) closeModal();
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
        closeModal();
        persist(); populateSort(); render();
        return true;
      },
      destroy: function(){
        /* The modal is parented to document.body, so it does NOT go away with the component's own
           markup when Bubble rebuilds the element — it has to be removed explicitly or it
           lingers as an orphan over the new instance. Same reasoning as prompts-table.js's
           bulk-bar destroy(). */
        if (modalBackdrop && modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
        modalBackdrop = null;
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
