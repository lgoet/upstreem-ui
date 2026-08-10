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
  /* setUpstreemTopics lives in core.js, not here -- but core.js can still be in flight when
     Bubble fires its "Load Topics" step. Stub it into a queue core drains the moment it defines
     the real one, so an early call is delayed rather than lost. Only installed if nothing owns
     the name yet: if core.js already loaded, the real function must stay. */
  if (!window.setUpstreemTopics) {
    window.setUpstreemTopics = function (rows) {
      (window.__upTopicsQueue = window.__upTopicsQueue || []).push(rows);
    };
  }

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
    /* Same clear-X core's search fields use, stroke-width and all. */
    x: '<svg viewBox="0 0 24 24" stroke-width="3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    /* Feather "x" at its own stroke weight, for the clear-X that replaces the chevron on hover.
       The one above is the SEARCH field's clear icon and deliberately heavier (3.5) because it
       sits inside an input at a smaller optical size. Reusing it on the trigger made a chunky
       cross next to a 1.8-weight chevron. */
    xThin: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    /* The sorter glyph the rest of the app uses -- lines narrowing toward the CENTRE, not
        left-aligned. Copied from prompts-table's GRPSIDE_SORT_ICON rather than drawn again. */
    sort: '<svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>',
    /* core's CHECK_SVG verbatim -- same glyph and the same stroke-width the companies and types
       checkboxes draw, so the tick cannot look "a bit different" next to them. */
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    cbOff: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/></svg>',
    cbOn:  '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M17.2 8.8 10.4 15.6 6.8 12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    /* prompts-table's GRP_ICON verbatim. The same control has to look the same in both places, and
       these two are the only ones in the app that open custom groupings. */
    group: '<svg viewBox="0 0 24 24" stroke-width="1.7"><rect x="3.75" y="5.25" width="16.5" height="5.25" rx="1.5"/><rect x="11.25" y="13.5" width="9" height="5.25" rx="1.5"/><polyline points="3.75,13.5 6.75,16.5 3.75,19.5"/></svg>'
  };

  /* Custom groupings are written by the prompts table and read here. Same localStorage key, same
     team scoping through UC.storeKey -- a grouping is a list of TAG IDS, and a tag id from one team
     resolves to nothing in another, so an unscoped key would produce silently empty groupings.
     Deliberately read on every render rather than cached: the prompts table can add or rename one
     while this dropdown is open on the same page, and there is no event between the two. */
  function groupsKey(){ return UC.storeKey ? UC.storeKey("promptGroups") : "promptGroups"; }
  function readCustomGroups(){
    try {
      var raw = window.localStorage.getItem(groupsKey());
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (g) {
        return g && typeof g.key === "string" && g.key && Array.isArray(g.tag_ids) && g.tag_ids.length;
      });
    } catch (e) { return []; }
  }

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
    /* Persisted with the rest of the instance state: Bubble rebuilds this element repeatedly, and
       a section the user opened should not close itself on the next re-render. */
    var groupsOpen = !!saved.groupsOpen;
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
      /* Repair + parse live in core as UC.parseLoose -- this is not the only place a Bubble-built
         string arrives (dashboard-page-header takes its KPI array the same way), and the five
         kinds of damage Bubble does to such a string are worth fixing in exactly one place.
         Untouched placeholder = the element was pasted but never filled in, which is not an error. */
      if (raw && raw.indexOf("TOPICS_JSON") < 0) {
        seeded = UC.parseLoose ? UC.parseLoose(raw, "topics-filter " + instanceId) : null;
      }
    }

    root.classList.add("utf-root");
    root.innerHTML =
      '<div class="utf-wrap">' +
        '<button class="utf-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
          ICON.tag + '<span class="utf-label">Topics</span>' +
          /* See models-filter.js: both glyphs in the DOM, CSS swaps them on hover once something
             is selected. */
          '<span class="utf-chev">' +
            '<span class="utf-chev-down">' + ICON.chev + '</span>' +
            '<span class="utf-chev-x" role="button" tabindex="-1" aria-label="Clear selection">' + ICON.xThin + '</span>' +
          '</span>' +
        '</button>' +
        '<div class="utf-menu" role="dialog">' +
          /* Search row: input with the magnifier INSIDE on the right, and Clear as its own button
             beside it -- the shape the app already uses, not an icon tucked into the field. */
          '<div class="utf-search-row">' +
            '<span class="up-ddsearch utf-search">' +
              '<input class="up-ddsearch-in utf-search-in" type="text" placeholder="Search topics" aria-label="Search topics">' +
              '<span class="up-ddsearch-ic">' + ICON.search + '</span>' +
              '<button class="up-ddsearch-x utf-search-x" type="button" aria-label="Clear search">' + ICON.x + '</button>' +
            '</span>' +
            '<span class="utf-sort">' +
              '<button class="utf-sort-btn" type="button" aria-label="Sort topics">' + ICON.sort + '</button>' +
              '<div class="utf-sort-menu" role="menu"></div>' +
            '</span>' +
            '<button class="utf-clear" type="button">Clear</button>' +
          '</div>' +
          '<div class="utf-list" role="listbox" aria-multiselectable="true"></div>' +
          '<div class="utf-foot">' +
            /* core's .up-seg / .up-seg-btn -- the app's switcher, not a copy of it. The copy is
               exactly why this ended up with a dark-mode selected colour no other switcher has. */
            '<span class="up-seg" role="group" aria-label="Match mode">' +
              '<button class="up-seg-btn" type="button" data-mode="or">Or</button>' +
              '<button class="up-seg-btn" type="button" data-mode="and">And</button>' +
            '</span>' +
            '<span class="utf-foot-right">' +
              '<button class="utf-grpbtn" type="button" data-tip="Show your saved groupings" aria-label="Custom groupings" aria-pressed="false">' +
                ICON.group + '<span class="utf-grpbtn-dot"></span>' +
              '</button>' +
              (wantsNewTopic() ? '<button class="utf-new" type="button">' + ICON.plus + '<span>New Topic</span></button>' : '') +
            '</span>' +
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
    var elMode    = root.querySelector(".utf-foot");
    var elList    = root.querySelector(".utf-list");
    var elGrpBtn  = root.querySelector(".utf-grpbtn");
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
      /* Order stays exactly as sorted -- ticking a topic must NOT move it. The companies and
         types dropdowns behave this way and they are the reference; a row jumping out from under
         the cursor is worse than having the selection spread through the list. */
      return { on: [], off: list, all: list };
    }

    /* ---------------- render ---------------- */
    function renderSortMenu() {
      elSortMenu.innerHTML = SORTS.map(function (s) {
        return '<button class="up-optrow utf-sort-opt' + (s.key === sortKey ? " is-on" : "") +
               '" type="button" role="menuitem" data-sort="' + s.key + '">' + esc(s.label) +
               '<span class="up-optrow-check">' + ICON.check + '</span></button>';
      }).join("");
    }
    function optHtml(t, idx) {
      var on = isSel(t.id);
      /* Checkbox left, then the colour chip, name, count -- the row shape the app already uses.
         The chip is a rounded square, not a circle: that is what a topic looks like everywhere
         else in this product, and it was the single biggest reason the first version read as
         foreign. Emoji replaces the chip when the topic has one, same as Mira. */
      var mark = t.emoji ? '<span class="utf-opt-emoji">' + esc(t.emoji) + '</span>'
                         : '<span class="utf-opt-dot"></span>';
      /* .up-filter-item / .up-filter-check straight from core -- the SAME checkbox the companies
         and types dropdowns use, in both themes. Drawing an own one was the mistake: it looked
         close in light mode and wrong in dark, because core flips the tick colour there. */
      return '<div class="up-filter-item utf-opt' + (on ? " is-checked" : "") + (idx === cursor ? " is-cursor" : "") +
             '" role="option" tabindex="0" aria-selected="' + (on ? "true" : "false") +
             '" data-id="' + esc(t.id) + '" data-idx="' + idx + '" style="--utf-tc:' + esc(hex(t)) + '">' +
               '<span class="up-filter-check">' + ICON.check + '</span>' +
               '<span class="utf-opt-main">' + mark +
                 '<span class="utf-opt-name">' + esc(t.name) + '</span>' +
               '</span>' +
               '<span class="utf-opt-count">' + toNum(t.prompt_count) + '</span>' +
             '</div>';
    }
    /* A grouping is "selected" when every topic in it is. That is the only definition that makes
       the row's checkbox honest: a partially selected grouping is not the state the row offers, it
       is a state you can reach by ticking topics individually. Clicking therefore selects ALL of
       its topics, or clears them if they were all on already. */
    function groupTopicIds(g) {
      var have = {};
      topics.forEach(function (t) { have[t.id] = 1; });
      return g.tag_ids.filter(function (id) { return have[id]; });
    }
    function groupOn(g) {
      var ids = groupTopicIds(g);
      return ids.length > 0 && ids.every(function (id) { return isSel(id); });
    }
    function groupsHtml() {
      if (!groupsOpen) return "";
      var raw = readCustomGroups();
      /* A grouping whose topics have all been deleted is dropped rather than listed. It cannot be
         ticked and it carries no count to explain why, so leaving it in would be a dead row that
         looks exactly like a working one. */
      var list = raw.filter(function (g) { return groupTopicIds(g).length > 0; });
      /* The search filters groupings by name too. Typing narrows one list, not one of two. */
      var q = query.toLowerCase();
      if (q) list = list.filter(function (g) { return g.key.toLowerCase().indexOf(q) >= 0; });
      if (!list.length) {
        var msg = q ? "No groupings match"
                    : (raw.length ? "None apply to these topics" : "None saved yet");
        return '<div class="utf-grp-sec">' +
                 '<div class="utf-grp-head">Custom Groupings</div>' +
                 '<div class="utf-grp-none">' + msg + '</div>' +
               '</div>';
      }
      /* No count on the right, unlike a topic row: a topic's number is how many prompts carry it,
         which is a property of the topic. A grouping's would be how many of its topics happen to
         still exist -- an artefact of this list, not information about the grouping. */
      var rows = list.map(function (g) {
        var on = groupOn(g);
        return '<div class="up-filter-item utf-opt utf-grp-opt' + (on ? " is-checked" : "") +
               '" role="option" tabindex="0" aria-selected="' + (on ? "true" : "false") +
               '" data-group="' + esc(g.key) + '">' +
                 '<span class="up-filter-check">' + ICON.check + '</span>' +
                 '<span class="utf-opt-main">' +
                   '<span class="utf-grp-ic">' + ICON.group + '</span>' +
                   '<span class="utf-opt-name">' + esc(g.key) + '</span>' +
                 '</span>' +
               '</div>';
      }).join("");
      return '<div class="utf-grp-sec">' +
               '<div class="utf-grp-head">Custom Groupings</div>' + rows +
             '</div>';
    }
    function renderList() {
      var v = visible();
      var grp = groupsHtml();
      if (!v.all.length) {
        elList.innerHTML = grp +
          '<div class="utf-empty">' + (topics.length ? "No topics match" : "No topics yet") + '</div>';
        return;
      }
      var i = 0, html = "";
      v.all.forEach(function (t) { html += optHtml(t, i++); });
      elList.innerHTML = grp + html;
    }
    function renderTrigger() {
      var n = selected.length;
      root.classList.toggle("has-sel", n > 0);
      var dot = elTrigger.querySelector(".utf-trigger-dot");
      if (dot) dot.parentNode.removeChild(dot);
      var oldBadge = elTrigger.querySelector(".utf-count");
      if (oldBadge) oldBadge.parentNode.removeChild(oldBadge);
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
        /* Ab zwei Auswahlen ein Zaehler-Badge statt "Topics · N": eine gefuellte Scheibe traegt die
           Zahl schneller als ein Mitteltrenner, und der Trigger bleibt gleich breit egal ob 2
           oder 12 gewaehlt sind. Bei genau einer Auswahl gewinnt der Topic-NAME oben -- ein
           Badge mit einer 1 sagt weniger als das Wort. */
        elLabel.textContent = "Topics";
        if (n > 1){
          var b = document.createElement("span");
          b.className = "utf-count";
          b.textContent = String(n);
          elTrigger.insertBefore(b, elTrigger.querySelector(".utf-chev"));
        }
      }
    }
    function renderMode() {
      /* Always live. It was disabled below two selections, but the mode is a persistent setting
         the user may want to set before picking anything -- and a control that greys itself out
         reads as broken. */
      var opts = elMode.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < opts.length; i++) {
        opts[i].classList.toggle("is-active", opts[i].getAttribute("data-mode") === mode);
      }
    }
    function renderGroupsBtn() {
      if (!elGrpBtn) return;
      elGrpBtn.classList.toggle("is-on", groupsOpen);
      elGrpBtn.setAttribute("aria-pressed", groupsOpen ? "true" : "false");
    }
    function render() { renderList(); renderTrigger(); renderMode(); renderSortMenu(); renderGroupsBtn(); }

    function persist() {
      STATE[instanceId] = { selected: selected.slice(), mode: mode, sortKey: sortKey, groupsOpen: groupsOpen };
    }

    /* ---------------- publish ----------------
       Always the whole state, never a delta: a single dropped event would otherwise leave Bubble
       filtering on something the UI no longer shows. */
    function emit() {
      var payload = {
        instance_id: instanceId,
        topic_ids: selected.join(","),
        tag_mode: mode,
        count: selected.length
      };
      /* Same team_id every other event carries (core adds it inside makeFire; this component
         publishes directly, so it is added here). Lets the receiving workflow drop a payload that
         belongs to a team the page has since navigated away from. */
      try { var tid = UC.getTeam && UC.getTeam(); if (tid) payload.team_id = tid; } catch(e){}
      var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }

      /* TWO channels, because there are genuinely two receivers and one call can only reach one
         element:
           data-topics-fn        the element INSIDE the reusable. It owns the selection -- it is
                                 what puts topic_ids and tag_mode into the reusable's own states.
           data-topics-apply-fn  an element ON THE PAGE. It is what tells the table to reload.
                                 A reusable cannot trigger a page-level workflow by itself, which
                                 is the whole reason this second name exists; without it the only
                                 way up was a counter state the page had to watch.
         Fired in that order so the reusable's states are already set when the page reacts -- but
         the page element receives the identical JSON, so a workflow there never has to read those
         states at all. Optional: no attribute, no call, no warning. */
      /* data-local="yes": the selection never leaves the page. Used where the host reads it from
         the DOM event below and turns it into something of its own -- Mira builds a sentence for
         its report prompt out of it, there is no Bubble workflow to notify. Without this, an
         unset data-topics-fn falls back to bubble_fn_utfTopics and a purely local picker would
         start poking whatever workflow happens to own that name on the page. */
      if (!isLocal()) {
        fireTo(root.getAttribute("data-topics-fn") || "bubble_fn_utfTopics", json, true);
        fireTo(root.getAttribute("data-topics-apply-fn"), json, false);
      }
      try { root.dispatchEvent(new CustomEvent("utf-topics", { detail: payload, bubbles: true })); } catch (e) {}
    }

    /* required=false means the name is optional: only complain when an attribute was actually
       set and the function behind it is missing -- a typo stays loud, an unused channel stays
       quiet. */
    function isLocal() { return isYes(root.getAttribute("data-local")); }
    /* data-newtopic="no" (implied by data-local) drops the New Topic button entirely -- a picker
       that only narrows an existing list has no business creating rows in it. */
    function wantsNewTopic() {
      var v = root.getAttribute("data-newtopic");
      if (v != null && !isYes(v)) return false;
      return !isLocal() || isYes(v);
    }

    /* Never return in silence on an empty name -- see STYLEGUIDE §46. The topics picker carries
       the same two-channel design the models picker does, and there the unfilled
       data-*-apply-fn attribute cost a debugging round: eleven placements, no page-level
       workflow, and nothing anywhere saying so. Said once per instance, not per click.
       No name is DERIVED here on purpose: this app's topics events are not uniformly named
       (utfTopics_* alongside utfsettopics_*), so a guess would call the wrong thing. */
    var warnedApply = false;
    function fireTo(name, json, required) {
      if (!name) {
        if (!required && !warnedApply && window.console) {
          warnedApply = true;
          console.info("[topics-filter] " + instanceId + ": data-topics-apply-fn is empty, so no " +
            "page-level workflow hears about this change. That is fine when the page reads the " +
            "selection out of the reusable's states; set the attribute if a table has to reload.");
        }
        return;
      }
      var fn = UC.resolveBubbleFn(name);
      if (typeof fn === "function") { try { fn(json); } catch (e) {} return; }
      if (window.console) {
        console.warn("[topics-filter] " + name + " not found — this change reached no Bubble workflow." +
          (required ? "" : " (data-topics-apply-fn)"));
      }
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
        /* Deliberately NOT focused: opening a filter should not put a keyboard cursor in a
           field the user did not ask for -- it steals the page's scroll anchor on mobile and
           makes Escape ambiguous. Typing still works, the list is one Tab away. */
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
    elTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      /* The chevron doubles as a clear button while a filter is active, same as in the models
         picker. It does NOT toggle the panel: aiming at an X means "remove the filter". */
      var onX = false;
      try { onX = !!(e.target.closest && e.target.closest(".utf-chev-x")); } catch (err) {}
      if (onX && root.classList.contains("has-sel")) {
        selected = [];
        commit();
        return;
      }
      setOpen(!open);
    });
    elMenu.addEventListener("click", function (e) {
      e.stopPropagation();
      /* A click anywhere else in the panel dismisses the sorter -- the document-level handler
         never sees these because of the stopPropagation above. */
      if (sortOpen && !elSort.contains(e.target)) setSortOpen(false);
    });
    /* A body-mounted overlay is not "outside": the topic modal is opened BY the New Topic button
       in this very panel and lives in <body> by construction, so every click in it -- including
       Save -- read as a click outside and shut the panel behind it. core's registry handler grew
       the same exemption; this is the component's own copy of the rule. */
    function inOverlay(t) {
      try { return !!(t && t.closest && t.closest(".up-topicmodal-backdrop, .up-modal, .up-portal, [popover]")); }
      catch (e) { return false; }
    }
    document.addEventListener("click", function (e) {
      if (inOverlay(e.target)) return;
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

    root.querySelector(".utf-search-x").addEventListener("click", function (e) {
      e.stopPropagation();
      query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
      cursor = -1; renderList(); try { elSearchIn.focus(); } catch (e2) {}
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
      persist(); render();
      /* Only publish when the mode actually changes which prompts come back. With fewer than two
         topics selected, Or and And describe the same set, so the switch is a preference the user
         is setting ahead of time and not a filter change -- and a workflow that re-runs for an
         identical result is a round trip for nothing. The next selection click sends the FULL
         state including this mode, so Bubble is never left guessing. */
      if (selected.length >= 2) emit();
    });

    function toggle(id) {
      if (!id) return;
      var i = selected.indexOf(id);
      if (i >= 0) selected.splice(i, 1); else selected.push(id);
      commit();
    }
    elList.addEventListener("click", function (e) {
      var g = e.target.closest ? e.target.closest("[data-group]") : null;
      if (g) { toggleGroup(g.getAttribute("data-group")); return; }
      var b = e.target.closest ? e.target.closest(".utf-opt") : null;
      if (!b) return;
      toggle(b.getAttribute("data-id"));
    });
    function toggleGroup(key) {
      var list = readCustomGroups(), g = null;
      for (var i = 0; i < list.length; i++) if (list[i].key === key) g = list[i];
      if (!g) return;
      var ids = groupTopicIds(g);
      if (!ids.length) return;                    // every topic in it has since been deleted
      if (groupOn(g)) {
        selected = selected.filter(function (id) { return ids.indexOf(id) < 0; });
      } else {
        ids.forEach(function (id) { if (selected.indexOf(id) < 0) selected.push(id); });
      }
      commit();
    }

    if (elGrpBtn) elGrpBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      groupsOpen = !groupsOpen;
      cursor = -1;
      persist(); renderList(); renderGroupsBtn();   // no selection changed: no event
    });

    root.querySelector(".utf-clear").addEventListener("click", function () {
      if (!selected.length) return;
      selected = [];
      commit();
    });

    /* New Topic goes through core's shared modal — the same one topics-manager and the prompts
       table's bulk editor open, so a topic created here looks and behaves identically. */
    var pendingNewTopic = false;
    var topicModal = UC.makeTopicModal ? UC.makeTopicModal({
      getIsDark: function () { return isDark; },
      onSave: function (payload) {
        var name = root.getAttribute("data-newtopic-fn") || "bubble_fn_utfNewTopic";
        var fn = UC.resolveBubbleFn(name);
        var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }
        if (typeof fn === "function") { try { fn(json); } catch (e) {} }
        else if (window.console) console.warn("[topics-filter] " + name + " not found — the new topic reached no workflow.");
        /* Tell the page its topic list is stale. Bubble saves the topic in the workflow above,
           then re-runs the RPC and calls setUpstreemTopics -- which is what puts the new topic
           into THIS dropdown and every other one, with a real id and a real prompt_count. This
           component deliberately does not insert it locally: a hand-made row would carry no id,
           so selecting it would send Bubble something it cannot resolve. */
        /* NO topicsChanged() here, deliberately -- and this is the correction of an earlier
           mistake. Firing it right after the create event starts a refresh that RACES the create
           workflow: Bubble runs both, the refresh reads the database before the insert has
           committed, and the list comes back without the new topic. The symptom is a list that is
           always exactly one create behind. (An earlier version compared names to decide when to
           close, which accidentally masked this by ignoring the too-early list and waiting for the
           next one -- it looked better while being wrong for a second reason.)
           Only Bubble knows when its own create is done, so only Bubble can order this: the create
           workflow ends with "Trigger custom event: Load Topics". See the Bubble file.
        */
        /* The modal deliberately stays open until the save is CONFIRMED -- there is no optimistic
           id to show on create, so closing on click would claim success before Bubble has one.
           The confirmation is the refreshed list arriving with this name in it; setTopics closes
           it then. core's own timeout stays as the fallback if the RPC never answers. */
        pendingNewTopic = true;
      }
    }) : null;
    var elNew = root.querySelector(".utf-new");
    if (elNew) elNew.addEventListener("click", function () {
      if (topicModal) topicModal.open("create");
      else if (window.console) console.warn("[topics-filter] UC.makeTopicModal missing — core.js is too old for the New Topic button.");
    });

    /* ---------------- attributes ---------------- */
    function syncConfig() {
      var wantDark = isYes(root.getAttribute("data-isdark"));
      if (wantDark !== isDark) { isDark = wantDark; }
      if (isDark) root.setAttribute("data-theme", "dark");
      else if (root.getAttribute("data-theme") !== "dark" || root.hasAttribute("data-isdark")) root.removeAttribute("data-theme");
      /* is-processing is now PURELY cosmetic -- it neither closes the panel nor blocks a click.
         Both of those were here and both were wrong for this control:
           - closing on processing meant the panel shut on every single selection, because Bubble
             flips the flag the moment the RPC starts. Picking three topics in a row was
             impossible; the second click landed on a panel that had just closed.
           - pointer-events:none on the trigger turned a stuck flag into a dead component. If
             Bubble ever failed to set it back to "no" -- one missed workflow branch -- the
             dropdown could not even be opened again for the rest of the session.
         Neither is needed: emit() always sends the COMPLETE selection, never a delta, so a click
         that lands mid-refresh cannot desync anything. The next click states the full truth again. */
      root.classList.toggle("is-processing", isYes(root.getAttribute("data-isprocessing")));
    }
    /* Own observer: core has watchRoots for elements appearing, but no shared attribute watcher,
       and Bubble delivers theme and busy state purely as attribute writes. */
    try {
      new MutationObserver(syncConfig).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-isprocessing"]
      });
    } catch (e) {}
    if (UC.unclipAncestors) UC.unclipAncestors(root);
    /* The app's shared tooltip. This file had no tooltips at all until the groupings button
       arrived, so the data-tip on it did nothing on its own. Reads isDark through a getter rather
       than a value because the theme can flip long after mount. */
    if (UC.makeTooltips) UC.makeTooltips(root, function () { return isDark; });

    var ctrl = {
      root: root,
      instanceId: instanceId,
      setTopics: function (rows) {
        topics = Array.isArray(rows) ? rows.slice() : [];
        /* The ARRIVAL of a fresh list is the confirmation, not what is in it.
           This used to look for the new name in the list, and that hung the modal open on
           '\'f98()' -- any transformation on the way through Bubble (entity escaping, trimming,
           a sanitiser touching punctuation) makes a name comparison miss, and a missed comparison
           means the user sits in a modal that never closes. A name is data; whether the round
           trip finished is not something data should decide.
           If the create actually failed, the list simply comes back without the topic and the
           user sees that -- which is the honest outcome, and better than a stuck dialog.
           core's own timeout still covers the case where no list arrives at all. */
        if (pendingNewTopic && topicModal && topicModal.isOpen && topicModal.isOpen()) {
          pendingNewTopic = false;
          try { topicModal.close(); } catch (e) {}
        }
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
    /* Order matters: the page-wide store WINS over the seed block. The seed is the value baked
       into the markup at page build, so it is the right thing for the very first paint -- but if
       a "Load Topics" step already ran (or this instance is only being built now, several Bubble
       re-renders in), the store holds the newer list and the seed would be a step backwards. */
    var fromStore = UC.getTopics ? UC.getTopics() : [];
    if (fromStore && fromStore.length) topics = fromStore;
    else if (seeded) topics = Array.isArray(seeded) ? seeded : [];
    render();

    /* ...and stay subscribed, so one setUpstreemTopics() call updates every picker on the page --
       including this one if it mounts later, which is the case a per-instance setter could never
       reach. Selection survives: setTopics keeps ids that are still in the list. */
    if (UC.onTopics) UC.onTopics(function (list) { ctrl.setTopics(list); }, root);

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
