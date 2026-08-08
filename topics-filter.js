/* upstreem topics-filter.js — the Topics filter dropdown (prefix `utf`).
   Load core.js first.

   Multi-instance by data-instance, same contract the date range picker uses, because a page
   carries several of these (one per view). Every API call resolves by exact id OR prefix, and a
   call that arrives before its element exists is queued and replayed on mount — that whole set of
   lessons is copied deliberately from date-range.js, where each one cost a debugging round.

   No Apply button: every click publishes. The payload is always the full state, never a delta,
   so a missed event cannot desync Bubble from the UI. */
(function () {
  var UC = window.UpstreemCore;
  if (!UC) { if (window.console) console.error("UpstreemCore (core.js) not loaded"); return; }

  /* ---- boot stubs (STYLEGUIDE §25) --------------------------------------------------------
     Bubble fires workflows before this file finishes loading. The names have to exist from the
     first tick and replay in call order. */
  var API_NAMES = ["setTopicsFilterTopics", "resetTopicsFilter", "setTopicsFilterSelected",
                   "setTopicsFilterMode", "setTopicsFilterTheme"];
  var Q = (window.__utfBootQueue = window.__utfBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  var CONTROLLERS = [];
  var PENDING = {};
  /* Survives a Bubble re-render of the element, keyed by instance — same reason prompts-table
     keeps its own store: a rebuilt element must continue the filter, not restart it. */
  var STATE = (window.__utfStore = window.__utfStore || {});

  var ICON = {
    tag: '<svg viewBox="0 0 24 24"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    sort: '<svg viewBox="0 0 24 24"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="15" y2="12"/><line x1="4" y1="17" x2="10" y2="17"/></svg>',
    check: '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
  };

  var SORTS = [
    { key: "used",  label: "Most used" },
    { key: "new",   label: "Newest" },
    { key: "name",  label: "Name" }
  ];
  var DEFAULT_SORT = "used";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function toNum(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function isYes(v) { return UC.isYes ? UC.isYes(v) : String(v).toLowerCase() === "yes"; }

  function initRoot(root) {
    if (!root) return null;
    /* Re-adopt rather than rebuild when the element was detached and put back: the controller is
       still valid, it was only pruned from CONTROLLERS while its root was off-document. Skipping
       this is what made the date range picker invisible to its own API for a whole page session. */
    if (root.__utfCtrl) {
      if (CONTROLLERS.indexOf(root.__utfCtrl) < 0) CONTROLLERS.push(root.__utfCtrl);
      return root.__utfCtrl;
    }

    var instanceId = String(root.getAttribute("data-instance") || "").trim() ||
                     ("utf-" + Math.random().toString(36).slice(2, 10));
    root.setAttribute("data-instance", instanceId);

    var saved = STATE[instanceId] || {};
    var topics = [];                                  // full list as delivered
    var selected = saved.selected ? saved.selected.slice() : [];
    var mode = (saved.mode === "and") ? "and" : "or";
    var sortKey = saved.sortKey || DEFAULT_SORT;
    var query = "";
    var open = false, sortOpen = false, cursor = -1;
    var isDark = false;

    /* Topics authored straight into the element, so a page needs no Run-JavaScript step at all.
       Read BEFORE the innerHTML assignment below, which would otherwise destroy the block.
       type="application/json" on purpose: the browser does not execute it, so the array can
       contain anything a topic name might contain without being parsed as code -- no escaping
       rules to get wrong, unlike a value pasted into a JS call. A later
       setTopicsFilterTopics() simply replaces whatever was seeded here. */
    var seeded = null;
    var seedEl = root.querySelector(".utf-topics-json");
    if (seedEl) {
      var raw = String(seedEl.textContent || "").trim();
      if (raw && raw.indexOf("TOPICS_JSON") < 0) {          // untouched placeholder = not filled in yet
        try { seeded = JSON.parse(raw); }
        catch (e) {
          if (window.console) console.warn("[topics-filter] the embedded topics JSON of \"" +
            instanceId + "\" is not valid JSON — ignored:", e.message);
        }
      }
    }

    root.classList.add("utf-root");
    root.innerHTML =
      '<div class="utf-wrap">' +
        '<button class="utf-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
          ICON.tag + '<span class="utf-label">Topics</span>' +
          '<span class="utf-chev">' + ICON.chev + '</span>' +
        '</button>' +
        '<div class="utf-menu" role="dialog">' +
          '<div class="utf-head">' +
            '<span class="utf-search">' +
              '<span class="utf-search-ic">' + ICON.search + '</span>' +
              '<input class="utf-search-in" type="text" placeholder="Search topics" aria-label="Search topics">' +
              '<button class="utf-search-clear" type="button" aria-label="Clear search">' + ICON.x + '</button>' +
            '</span>' +
            '<span class="utf-sort">' +
              '<button class="utf-sort-btn" type="button" data-tip="Sort topics" aria-label="Sort topics">' + ICON.sort + '</button>' +
              '<div class="utf-sort-menu" role="menu"></div>' +
            '</span>' +
          '</div>' +
          '<div class="utf-mode">' +
            '<span class="utf-mode-lbl">Match</span>' +
            '<span class="utf-seg" role="group" aria-label="Match mode">' +
              '<button class="utf-seg-opt" type="button" data-mode="or">Any</button>' +
              '<button class="utf-seg-opt" type="button" data-mode="and">All</button>' +
            '</span>' +
          '</div>' +
          '<div class="utf-sep"></div>' +
          '<div class="utf-list" role="listbox" aria-multiselectable="true"></div>' +
          '<div class="utf-foot">' +
            '<button class="utf-foot-btn utf-new" type="button">' + ICON.plus + '<span>New Topic</span></button>' +
            '<button class="utf-foot-btn utf-clear" type="button">Clear all</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var elWrap    = root.querySelector(".utf-wrap");
    var elTrigger = root.querySelector(".utf-trigger");
    var elLabel   = root.querySelector(".utf-label");
    var elMenu    = root.querySelector(".utf-menu");
    var elSearch  = root.querySelector(".utf-search");
    var elSearchIn= root.querySelector(".utf-search-in");
    var elSort    = root.querySelector(".utf-sort");
    var elSortMenu= root.querySelector(".utf-sort-menu");
    var elMode    = root.querySelector(".utf-mode");
    var elList    = root.querySelector(".utf-list");
    var unregister = null;

    /* ---------------- data helpers ---------------- */
    function hex(t) { return (isDark ? t.hex_dark : t.hex_light) || t.hex_light || t.hex_dark || "#808080"; }
    function isSel(id) { return selected.indexOf(id) >= 0; }
    function visible() {
      var q = query.toLowerCase();
      var list = topics.filter(function (t) {
        if (t.is_active === false) return false;      // inactive topics are simply not offered
        return !q || String(t.name || "").toLowerCase().indexOf(q) >= 0;
      });
      list.sort(function (a, b) {
        if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || ""));
        if (sortKey === "new")  return String(b.created_at || "").localeCompare(String(a.created_at || ""));
        return toNum(b.prompt_count) - toNum(a.prompt_count);
      });
      /* Selected first, and stable within each block. Without this the topic you just ticked
         jumps somewhere else the moment you type, which is the single most common annoyance in
         filter dropdowns of this shape. */
      var on = [], off = [];
      list.forEach(function (t) { (isSel(t.id) ? on : off).push(t); });
      return { on: on, off: off, all: on.concat(off) };
    }

    /* ---------------- render ---------------- */
    function renderSortMenu() {
      elSortMenu.innerHTML = SORTS.map(function (s) {
        return '<button class="utf-sort-opt' + (s.key === sortKey ? " is-on" : "") +
               '" type="button" role="menuitem" data-sort="' + s.key + '">' + esc(s.label) + '</button>';
      }).join("");
    }
    function optHtml(t, idx) {
      var em = t.emoji ? '<span class="utf-opt-emoji">' + esc(t.emoji) + '</span>'
                       : '<span class="utf-opt-dot" style="background:' + esc(hex(t)) + '"></span>';
      return '<button class="utf-opt' + (isSel(t.id) ? " is-on" : "") + (idx === cursor ? " is-cursor" : "") +
             '" type="button" role="option" aria-selected="' + (isSel(t.id) ? "true" : "false") +
             '" data-id="' + esc(t.id) + '" data-idx="' + idx + '">' +
               em +
               '<span class="utf-opt-name">' + esc(t.name) + '</span>' +
               '<span class="utf-opt-count">' + toNum(t.prompt_count) + '</span>' +
               '<span class="utf-opt-check">' + ICON.check + '</span>' +
             '</button>';
    }
    function renderList() {
      var v = visible();
      if (!v.all.length) {
        elList.innerHTML = '<div class="utf-empty">' + (topics.length ? "No topics match" : "No topics yet") + '</div>';
        return;
      }
      var i = 0, html = "";
      v.on.forEach(function (t) { html += optHtml(t, i++); });
      if (v.on.length && v.off.length) html += '<div class="utf-pinsep"></div>';
      v.off.forEach(function (t) { html += optHtml(t, i++); });
      elList.innerHTML = html;
    }
    function renderTrigger() {
      var n = selected.length;
      root.classList.toggle("has-sel", n > 0);
      var dot = elTrigger.querySelector(".utf-trigger-dot");
      if (dot) dot.parentNode.removeChild(dot);
      if (n === 1) {
        var t = null;
        for (var i = 0; i < topics.length; i++) if (topics[i].id === selected[0]) t = topics[i];
        elLabel.textContent = t ? String(t.name) : "1 Topic";
        if (t) {
          var s = document.createElement("span");
          s.className = "utf-trigger-dot";
          s.style.background = hex(t);
          elTrigger.insertBefore(s, elLabel);
        }
      } else {
        elLabel.textContent = n ? ("Topics · " + n) : "Topics";
      }
    }
    function renderMode() {
      /* Idle below two selections: with one topic "Any" and "All" produce the same rows, so the
         control shows its state without inviting a choice that does nothing. */
      elMode.classList.toggle("is-idle", selected.length < 2);
      var opts = elMode.querySelectorAll(".utf-seg-opt");
      for (var i = 0; i < opts.length; i++) {
        opts[i].classList.toggle("is-on", opts[i].getAttribute("data-mode") === mode);
      }
    }
    function render() { renderList(); renderTrigger(); renderMode(); renderSortMenu(); }

    function persist() {
      STATE[instanceId] = { selected: selected.slice(), mode: mode, sortKey: sortKey };
    }

    /* ---------------- publish ----------------
       Always the whole state, never a delta: a single dropped event would otherwise leave Bubble
       filtering on something the UI no longer shows. */
    function emit() {
      var payload = {
        instance_id: instanceId,
        topic_ids: selected.join(","),
        tag_mode: selected.length > 1 ? mode : "or",
        count: selected.length
      };
      var name = root.getAttribute("data-topics-fn") || "utfTopics";
      var fn = UC.resolveBubbleFn(name);
      var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }
      if (typeof fn === "function") { try { fn(json); } catch (e) {} }
      else if (window.console) {
        console.warn("[topics-filter] " + name + " not found — this change reached no Bubble workflow.");
      }
      try { root.dispatchEvent(new CustomEvent("utf-topics", { detail: payload, bubbles: true })); } catch (e) {}
    }

    function commit() { persist(); render(); emit(); }

    /* ---------------- open / close ---------------- */
    function setOpen(v) {
      if (open === v) return;
      open = v;
      elWrap.classList.toggle("is-open", open);
      elMenu.classList.toggle("is-shown", open);
      elTrigger.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        cursor = -1;
        /* Flip to the right edge when a left-aligned panel would leave the viewport. Set once on
           open, never on scroll -- the panel is absolute, so it moves with its trigger for free. */
        elMenu.classList.remove("is-right");
        var r = elMenu.getBoundingClientRect();
        if (r.right > (window.innerWidth || document.documentElement.clientWidth) - 8) elMenu.classList.add("is-right");
        unregister = UC.dropdownOpened ? UC.dropdownOpened(elMenu, function () { setOpen(false); }, elTrigger) : null;
        try { elSearchIn.focus({ preventScroll: true }); } catch (e) {}
      } else {
        setSortOpen(false);
        query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
        renderList();
        if (unregister) { unregister(); unregister = null; }
      }
    }
    function setSortOpen(v) {
      sortOpen = v;
      elSort.classList.toggle("is-open", sortOpen);
      /* Registered too, so the core rule closes it on the next unrelated dropdown -- and keeps the
         topics panel up, because that one contains this one. */
      if (sortOpen && UC.dropdownOpened) UC.dropdownOpened(elSortMenu, function () { setSortOpen(false); }, elSort);
    }

    /* ---------------- interactions ---------------- */
    elTrigger.addEventListener("click", function (e) { e.stopPropagation(); setOpen(!open); });
    elMenu.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function (e) {
      if (open && !root.contains(e.target)) setOpen(false);
      else if (sortOpen && !elSort.contains(e.target)) setSortOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape") { if (sortOpen) setSortOpen(false); else setOpen(false); return; }
      var rows = elList.querySelectorAll(".utf-opt");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!rows.length) return;
        e.preventDefault();
        cursor = (e.key === "ArrowDown" ? cursor + 1 : cursor - 1);
        if (cursor < 0) cursor = rows.length - 1;
        if (cursor >= rows.length) cursor = 0;
        renderList();
        var cur = elList.querySelector(".utf-opt.is-cursor");
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && cursor >= 0 && rows[cursor]) {
        e.preventDefault();
        toggle(rows[cursor].getAttribute("data-id"));
      }
    });

    elSearchIn.addEventListener("input", function () {
      query = String(elSearchIn.value || "").trim();
      elSearch.classList.toggle("has-text", !!elSearchIn.value.length);
      cursor = -1;
      renderList();
    });
    elSearch.querySelector(".utf-search-clear").addEventListener("click", function () {
      query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
      renderList(); try { elSearchIn.focus(); } catch (e) {}
    });

    root.querySelector(".utf-sort-btn").addEventListener("click", function (e) {
      e.stopPropagation(); setSortOpen(!sortOpen);
    });
    elSortMenu.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-sort]") : null;
      if (!b) return;
      sortKey = b.getAttribute("data-sort");
      setSortOpen(false);
      persist(); render();                              // a re-sort changes no selection: no event
    });

    elMode.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-mode]") : null;
      if (!b) return;
      var next = b.getAttribute("data-mode");
      if (next === mode) return;
      mode = next;
      commit();
    });

    function toggle(id) {
      if (!id) return;
      var i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1); else selected.push(id);
      commit();
    }
    elList.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".utf-opt") : null;
      if (!b) return;
      toggle(b.getAttribute("data-id"));
    });

    root.querySelector(".utf-clear").addEventListener("click", function () {
      if (!selected.length) return;
      selected = [];
      commit();
    });

    /* New Topic goes through core's shared modal — the same one topics-manager and the prompts
       table's bulk editor open, so a topic created here looks and behaves identically. */
    var topicModal = UC.makeTopicModal ? UC.makeTopicModal({
      getIsDark: function () { return isDark; },
      onSave: function (payload) {
        var name = root.getAttribute("data-newtopic-fn") || "utfNewTopic";
        var fn = UC.resolveBubbleFn(name);
        var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }
        if (typeof fn === "function") { try { fn(json); } catch (e) {} }
        else if (window.console) console.warn("[topics-filter] " + name + " not found — the new topic reached no workflow.");
      }
    }) : null;
    root.querySelector(".utf-new").addEventListener("click", function () {
      if (topicModal) topicModal.open("create");
      else if (window.console) console.warn("[topics-filter] UC.makeTopicModal missing — core.js is too old for the New Topic button.");
    });

    /* ---------------- attributes ---------------- */
    function syncConfig() {
      var wantDark = isYes(root.getAttribute("data-isdark"));
      if (wantDark !== isDark) { isDark = wantDark; }
      if (isDark) root.setAttribute("data-theme", "dark");
      else if (root.getAttribute("data-theme") !== "dark" || root.hasAttribute("data-isdark")) root.removeAttribute("data-theme");
      root.classList.toggle("is-processing", isYes(root.getAttribute("data-isprocessing")));
      if (isYes(root.getAttribute("data-isprocessing"))) setOpen(false);
    }
    /* Own observer: core has watchRoots for elements appearing, but no shared attribute watcher,
       and Bubble delivers theme and busy state purely as attribute writes. */
    try {
      new MutationObserver(syncConfig).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-isprocessing"]
      });
    } catch (e) {}
    if (UC.unclipAncestors) UC.unclipAncestors(root);

    var ctrl = {
      root: root,
      instanceId: instanceId,
      setTopics: function (rows) {
        topics = Array.isArray(rows) ? rows.slice() : [];
        /* Drop selections whose topic no longer exists, otherwise the trigger counts something
           the list cannot show and Clear all is the only way out. */
        var ids = {};
        topics.forEach(function (t) { ids[t.id] = 1; });
        var before = selected.length;
        selected = selected.filter(function (id) { return ids[id]; });
        persist(); render();
        if (selected.length !== before) emit();
      },
      setSelected: function (csv) {
        selected = String(csv == null ? "" : csv).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        persist(); render();                            // silent: this mirrors state Bubble already has
      },
      setMode: function (m) { mode = (String(m).toLowerCase() === "and") ? "and" : "or"; persist(); render(); },
      setTheme: function (t) { isDark = (String(t).toLowerCase() === "dark"); syncConfig(); render(); },
      reset: function () {
        selected = []; mode = "or"; query = "";
        elSearchIn.value = ""; elSearch.classList.remove("has-text");
        setOpen(false); persist(); render();             // SILENT, like every other reset in the repo
      },
      getSelected: function () { return { topic_ids: selected.join(","), tag_mode: mode }; }
    };
    root.__utfCtrl = ctrl;
    CONTROLLERS.push(ctrl);

    syncConfig();
    if (seeded) topics = Array.isArray(seeded) ? seeded : [];
    render();

    for (var pid in PENDING) {
      if (!Object.prototype.hasOwnProperty.call(PENDING, pid)) continue;
      if (instanceId !== pid && instanceId.indexOf(pid) !== 0) continue;
      var pfn = PENDING[pid];
      delete PENDING[pid];
      try { pfn(ctrl); } catch (e) {
        if (window.console) console.error("[topics-filter] queued call for \"" + pid + "\" failed:", e);
      }
    }
    return ctrl;
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".utf-root, [data-utf-root]"), function (r) {
      try { initRoot(r); }
      catch (e) {
        if (window.console) console.error("[topics-filter] mount failed for instance \"" +
          (r && r.getAttribute ? (r.getAttribute("data-instance") || "(no id)") : "?") + "\":", e);
      }
    });
  }
  function forEachInstance(instanceId, fn) {
    var id = String(instanceId || "").trim();
    var hit = false;
    CONTROLLERS = CONTROLLERS.filter(function (c) { return c.root && c.root.isConnected; });
    CONTROLLERS.forEach(function (c) {
      if (!id || c.instanceId === id || c.instanceId.indexOf(id) === 0) { fn(c); hit = true; }
    });
    if (!hit && id) {
      PENDING[id] = fn;
      if (window.console) {
        var roots = document.querySelectorAll(".utf-root, [data-utf-root]");
        var ids = [];
        for (var i = 0; i < roots.length; i++) ids.push(roots[i].getAttribute("data-instance") || "(no data-instance)");
        console.warn("[topics-filter] \"" + id + "\" not mounted yet — queued, will run when it appears." +
          "  Mounted: " + (CONTROLLERS.map(function (c) { return c.instanceId; }).join(", ") || "none") +
          "  |  .utf-root elements in the DOM: " + roots.length + (ids.length ? " (" + ids.join(", ") + ")" : ""));
      }
    }
    return hit;
  }

  window.setTopicsFilterTopics = function (instanceId, rows) {
    initAll();
    var list = rows;
    if (typeof list === "string") { try { list = JSON.parse(list); } catch (e) { list = []; } }
    return forEachInstance(instanceId, function (c) { c.setTopics(list); });
  };
  window.setTopicsFilterSelected = function (instanceId, csv) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setSelected(csv); });
  };
  window.setTopicsFilterMode = function (instanceId, m) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setMode(m); });
  };
  window.setTopicsFilterTheme = function (instanceId, t) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setTheme(t); });
  };
  window.resetTopicsFilter = function (instanceId) {
    initAll(); return forEachInstance(instanceId, function (c) { c.reset(); });
  };

  initAll();
  if (UC.watchRoots) UC.watchRoots("utf-root", initAll);

  if (Q && Q.length) {
    Q.splice(0, Q.length).forEach(function (entry) {
      try { window[entry[0]].apply(null, entry[1]); }
      catch (e) { if (window.console) console.error("[topics-filter] queued " + entry[0] + " failed:", e); }
    });
  }
})();
