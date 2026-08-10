/* upstreem markets-filter.js — the Markets filter dropdown (prefix `umk`).
   Load core.js first.

   The third of the three sibling pickers. Topics, Models and Markets share the same multi-instance
   contract, the same boot-stub queue, the same "every click publishes the FULL state, never a
   delta" rule and the same page-wide store. Read topics-filter.js for the reasoning behind those;
   only what is different here is commented below.

   What is specific to markets:
     - The list holds ONLY markets the team has actually assigned prompts to, and every row carries
       a prompt_count. That makes it live data, not config: adding or deleting a prompt changes
       both which markets exist and what they count. Hence UC.marketsChanged(), the invalidation
       the models picker has no counterpart for.
     - alpha2 is the key. It is what goes into the payload and what a saved selection stores.
     - The tile is a FLAG, and the fallback is the country code rather than a first letter: "DE"
       says more than "G" when a flag fails to load.
     - Sort is Most used / Name / Recent, the same three the topics picker offers, because a market
       has the same two orderings that actually matter plus a count to rank by. */
(function () {
  var UC = window.UpstreemCore;
  if (!UC) { if (window.console) console.error("UpstreemCore (core.js) not loaded"); return; }

  /* ---- boot stubs (STYLEGUIDE §25) --------------------------------------------------------
     Bubble fires workflows before this file finishes loading. The names have to exist from the
     first tick and replay in call order. */
  /* setUpstreemMarkets lives in core.js -- but core.js can still be in flight when Bubble fires its
     "Load Markets" step. Stub it into the queue core drains the moment it defines the real one.
     Only installed if nothing owns the name yet: if core.js already loaded, the real one stays. */
  if (!window.setUpstreemMarkets) {
    window.setUpstreemMarkets = function (rows) {
      (window.__upMarketsQueue = window.__upMarketsQueue || []).push(rows);
    };
  }

  var API_NAMES = ["setMarketsFilterMarkets", "resetMarketsFilter", "setMarketsFilterSelected",
                   "setMarketsFilterMode", "setMarketsFilterTheme"];
  var Q = (window.__umkBootQueue = window.__umkBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  var CONTROLLERS = [];
  var PENDING = {};
  /* Survives a Bubble re-render of the element, keyed by instance: a rebuilt element must continue
     the filter, not restart it. */
  var STATE = (window.__umkStore = window.__umkStore || {});
  /* URLs, die schon einmal erfolgreich geladen haben. Auf window, weil zwei data-cdn-pin-Werte
     diese Datei zweimal laden koennen und beide Kopien vom selben Wissen profitieren sollen.
     Beim echten Neuaufbau (neue Marketliste) wird die Kachel damit gar nicht erst gezeigt: das
     Bild liegt im Browser-Cache, hat aber trotzdem keinen Zustand, den das frische Markup kennt. */
  var FLAG_OK = (window.__umkFlagOk = window.__umkFlagOk || {});

  var ICON = {
    /* Feather "map-pin". Taken from the set, not drawn here. */
    pin: '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    /* Same clear-X core's search fields use, stroke-width and all. */
    x: '<svg viewBox="0 0 24 24" stroke-width="3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    /* The sorter glyph the rest of the app uses -- lines narrowing toward the CENTRE. */
    sort: '<svg viewBox="0 0 24 24"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>',
    /* core's CHECK_SVG verbatim, so the tick matches every other checked row in the app. */
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    /* Footer switcher: one dot against three. Filled circles, not outlined shapes, because at this
       size an outline of a 5px dot is a smudge.

       These two do NOT use the 24-box every other icon here uses, and that is the point: rendered
       at height 15 a 24-box scales by 0.625, so a gap authored as 4 units draws as 2.5px and the
       spec cannot be met at all -- three dots with 4px between them simply do not fit across 15px.
       The viewBox is therefore 1:1 with the rendered pixels (height 15, width auto), so r=2.5 is a
       5px dot and a 9-unit centre distance is exactly 4px of clear space. */
    single: '<svg viewBox="0 0 5 15"><circle cx="2.5" cy="7.5" r="2.5" fill="currentColor" stroke="none"/></svg>',
    multi:  '<svg viewBox="0 0 23 15">' +
              '<circle cx="2.5"  cy="7.5" r="2.5" fill="currentColor" stroke="none"/>' +
              '<circle cx="11.5" cy="7.5" r="2.5" fill="currentColor" stroke="none"/>' +
              '<circle cx="20.5" cy="7.5" r="2.5" fill="currentColor" stroke="none"/>' +
            '</svg>'
  };

  var SORTS = [
    { key: "used",   label: "Most used" },
    { key: "name",   label: "Name" },
    { key: "recent", label: "Recently used" }
  ];
  var DEFAULT_SORT = "used";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function isYes(v) { return UC.isYes ? UC.isYes(v) : String(v).toLowerCase() === "yes"; }
  /* Bubble file URLs arrive protocol-relative ("//x.cdn.bubble.io/..."); left alone they resolve
     against file:// in a local harness and against the wrong scheme in some embeds. Same repair
     urls-table does for its favicons. */
  function fixUrl(u) {
    u = String(u == null ? "" : u).trim();
    return u.indexOf("//") === 0 ? "https:" + u : u;
  }

  function initRoot(root) {
    if (!root) return null;
    /* Re-adopt rather than rebuild when the element was detached and put back: the controller is
       still valid, it was only pruned from CONTROLLERS while its root was off-document. */
    if (root.__umkCtrl) {
      if (CONTROLLERS.indexOf(root.__umkCtrl) < 0) CONTROLLERS.push(root.__umkCtrl);
      return root.__umkCtrl;
    }

    var instanceId = String(root.getAttribute("data-instance") || "").trim() ||
                     ("umk-" + Math.random().toString(36).slice(2, 10));
    root.setAttribute("data-instance", instanceId);

    var saved = STATE[instanceId] || {};
    var markets = [];                                  // full list as delivered
    /* SELECTION ORDER MATTERS here in a way it does not for topics: switching Multi -> Single has
       to keep exactly one, and "the one picked last" is the only choice that matches what the user
       just did. push() on select therefore has to stay push -- never unshift, never a re-sort. */
    var selected = saved.selected ? saved.selected.slice() : [];
    var mode = (saved.mode === "single") ? "single" : "multi";
    var sortKey = saved.sortKey || DEFAULT_SORT;
    var query = "";
    var open = false, sortOpen = false, cursor = -1;
    var isDark = false;

    /* Markets authored straight into the element, so a page needs no Run-JavaScript step at all.
       Read BEFORE the innerHTML assignment below, which would otherwise destroy the block.
       type="application/json" on purpose: the browser does not execute it, so the array can carry
       anything a display name might contain without being parsed as code. A later
       setMarketsFilterMarkets()/setUpstreemMarkets() simply replaces whatever was seeded here. */
    var seeded = null;
    var seedEl = root.querySelector(".umk-markets-json");
    if (seedEl) {
      var raw = String(seedEl.textContent || "").trim();
      if (raw && raw.indexOf("MODELS_JSON") < 0) {
        seeded = UC.parseLoose ? UC.parseLoose(raw, "markets-filter " + instanceId) : null;
      }
    }

    root.classList.add("umk-root");
    root.innerHTML =
      '<div class="umk-wrap">' +
        '<button class="umk-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="umk-trigger-ic">' + ICON.pin + '</span>' +
          '<span class="umk-label">Markets</span>' +
          /* Both glyphs live in the DOM; CSS swaps them on hover once something is selected.
             Rendering the X only on hover through JS would need mouseenter/mouseleave on a node
             that gets rebuilt on every selection change, and the two would drift apart. */
          '<span class="umk-chev">' +
            '<span class="umk-chev-down">' + ICON.chev + '</span>' +
            '<span class="umk-chev-x" role="button" tabindex="-1" aria-label="Clear selection">' + ICON.x + '</span>' +
          '</span>' +
        '</button>' +
        '<div class="umk-menu" role="dialog">' +
          /* Search row: input with the magnifier INSIDE on the right, Clear as its own button
             beside it -- the shape the app already uses. */
          '<div class="umk-search-row">' +
            '<span class="up-ddsearch umk-search">' +
              '<input class="up-ddsearch-in umk-search-in" type="text" placeholder="Search markets" aria-label="Search markets">' +
              '<span class="up-ddsearch-ic">' + ICON.search + '</span>' +
              '<button class="up-ddsearch-x umk-search-x" type="button" aria-label="Clear search">' + ICON.x + '</button>' +
            '</span>' +
            '<span class="umk-sort">' +
              '<button class="umk-sort-btn" type="button" aria-label="Sort markets">' + ICON.sort + '</button>' +
              '<div class="umk-sort-menu" role="menu"></div>' +
            '</span>' +
            '<button class="umk-clear" type="button">Clear</button>' +
          '</div>' +
          '<div class="umk-list" role="listbox" aria-multiselectable="true"></div>' +
          '<div class="umk-foot">' +
            /* core's .up-seg / .up-seg-btn -- the app's switcher, not a copy of it. Icon on top,
               label underneath, which is what "Icons mit Tooltips darunter" asks for and also
               keeps both buttons the same width regardless of word length. */
            '<span class="up-seg umk-seg" role="group" aria-label="Selection mode">' +
              '<button class="up-seg-btn umk-seg-btn" type="button" data-mode="single"' +
                ' aria-label="Single select" data-tip="Single select. Picking another market replaces the current one.">' +
                '<span class="umk-seg-ic">' + ICON.single + '</span>' +
              '</button>' +
              '<button class="up-seg-btn umk-seg-btn" type="button" data-mode="multi"' +
                ' aria-label="Multi select" data-tip="Multi select. Combine several markets in one filter.">' +
                '<span class="umk-seg-ic">' + ICON.multi + '</span>' +
              '</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var elWrap    = root.querySelector(".umk-wrap");
    var elTrigger = root.querySelector(".umk-trigger");
    var elTrigIc  = root.querySelector(".umk-trigger-ic");
    var elLabel   = root.querySelector(".umk-label");
    var elMenu    = root.querySelector(".umk-menu");
    var elSearch  = root.querySelector(".umk-search");
    var elSearchIn= root.querySelector(".umk-search-in");
    var elSort    = root.querySelector(".umk-sort");
    var elSortMenu= root.querySelector(".umk-sort-menu");
    var elMode    = root.querySelector(".umk-foot");
    var elList    = root.querySelector(".umk-list");
    var unregister = null;

    /* ---------------- data helpers ---------------- */
    /* alpha2 is the identity. alpha3 is accepted as a fallback only so a payload that ships one
       and not the other still selects; the payload always publishes what keyOf returned. */
    function keyOf(m) { return String((m && (m.alpha2 || m.alpha3)) || "").toUpperCase(); }
    function nameOf(m) { return String((m && (m.name || m.alpha2)) || ""); }
    function toNum(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function isSel(k) { return selected.indexOf(k) >= 0; }
    function byKey(k) {
      for (var i = 0; i < markets.length; i++) if (keyOf(markets[i]) === k) return markets[i];
      return null;
    }
    function visible() {
      var q = query.toLowerCase();
      var list = markets.filter(function (m) {
        if (!q) return true;
        /* Code and region are searchable alongside the name: people look for "DE" as often as for
           "Germany", and "Europe" is how you find a group of them at once. */
        return (nameOf(m) + " " + keyOf(m) + " " + String(m.region || "") + " " + String(m.subregion || ""))
                 .toLowerCase().indexOf(q) >= 0;
      });
      list.sort(function (a, b) {
        if (sortKey === "name") return nameOf(a).localeCompare(nameOf(b));
        if (sortKey === "recent") return String(b.last_used_at || "").localeCompare(String(a.last_used_at || ""));
        /* Most used, with the name as the tie-break so equal counts do not shuffle between
           renders -- Array.prototype.sort is only stable per engine, and a market jumping around
           on a re-render reads as a bug. */
        var d = toNum(b.prompt_count) - toNum(a.prompt_count);
        return d !== 0 ? d : nameOf(a).localeCompare(nameOf(b));
      });
      return list;
    }

    /* ---------------- render ---------------- */
    function renderSortMenu() {
      elSortMenu.innerHTML = SORTS.map(function (s) {
        return '<button class="up-optrow umk-sort-opt' + (s.key === sortKey ? " is-on" : "") +
               '" type="button" role="menuitem" data-sort="' + s.key + '">' + esc(s.label) +
               '<span class="up-optrow-check">' + ICON.check + '</span></button>';
      }).join("");
    }
    /* A logo that fails to load must not leave a broken-image glyph in a filter row, so the initial
       on a neutral tile sits underneath as a fallback.

       The tile is REMOVED again once the image actually loads. Leaving it visible was the bug: a
       market logo is usually a transparent PNG, so the grey square showed through everywhere the
       artwork was not opaque, and every row carried a visible box behind its logo. The tile now
       only survives where it is genuinely needed, which is no URL or a URL that failed.

       Wired in JS rather than as an inline onerror/onload attribute: the handlers have to cope
       with an image that is ALREADY complete by the time the markup lands (a cached logo fires
       neither event), and that check has nowhere to live in an attribute. */
    function flagHtml(m, cls) {
      var url = fixUrl(m.flag_url);
      /* The country code, not a first letter: a failed flag still tells you which market this is. */
      var initial = esc(keyOf(m) || "?");
      if (url && FLAG_OK[url]) cls += " has-img";
      return '<span class="' + cls + ' umk-flag">' +
               '<span class="umk-flag-fb">' + initial + '</span>' +
               (url ? '<img class="umk-flag-img" src="' + esc(url) + '" alt="" loading="lazy">' : '') +
             '</span>';
    }
    function wireFlags(scope) {
      if (!scope) return;
      var imgs = scope.querySelectorAll(".umk-flag-img");
      for (var i = 0; i < imgs.length; i++) (function (img) {
        if (img.__umkWired) return;
        img.__umkWired = true;
        function ok(){ var p = img.parentNode; if (p) p.classList.add("has-img"); FLAG_OK[img.src] = 1; }
        function bad(){ img.style.display = "none"; var p = img.parentNode; if (p) p.classList.remove("has-img"); }
        if (img.complete) { if (img.naturalWidth > 0) ok(); else bad(); return; }
        img.addEventListener("load", ok);
        img.addEventListener("error", bad);
      })(imgs[i]);
    }
    function optHtml(m, idx) {
      var k = keyOf(m);
      var on = isSel(k);
      return '<div class="up-filter-item umk-opt' + (on ? " is-checked" : "") + (idx === cursor ? " is-cursor" : "") +
             '" role="option" tabindex="0" aria-selected="' + (on ? "true" : "false") +
             '" data-key="' + esc(k) + '" data-idx="' + idx + '">' +
               '<span class="up-filter-check">' + ICON.check + '</span>' +
               '<span class="umk-opt-main">' + flagHtml(m, "umk-opt-flag") +
                 '<span class="umk-opt-name">' + esc(nameOf(m)) + '</span>' +
               '</span>' +
               '<span class="umk-opt-count">' + toNum(m.prompt_count) + '</span>' +
             '</div>';
    }
    function renderList() {
      var list = visible();
      if (!list.length) {
        elList.innerHTML = '<div class="umk-empty">' + (markets.length ? "No markets match" : "No markets yet") + '</div>';
        return;
      }
      var i = 0, html = "";
      list.forEach(function (m) { html += optHtml(m, i++); });
      elList.innerHTML = html;
      wireFlags(elList);
    }
    /* Selection and cursor are CLASS changes, not a reason to rebuild the list.
       Rebuilding innerHTML threw every <img> away and created a new one, so on each click the
       logos went through their fallback tile again for a frame or two: that was the flicker.
       The row ORDER never depends on the selection (see visible), so nothing has to move here. */
    function syncRows() {
      var rows = elList.querySelectorAll(".umk-opt");
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var on = isSel(r.getAttribute("data-key"));
        r.classList.toggle("is-checked", on);
        r.setAttribute("aria-selected", on ? "true" : "false");
        r.classList.toggle("is-cursor", Number(r.getAttribute("data-idx")) === cursor);
      }
    }
    /* The trigger holds a logo too, so the same rule applies: only touch it when what it shows
       actually changes. Without this the trigger's own logo blinked on every click. */
    var lastTrigKey = null;
    function renderTrigger() {
      var n = selected.length;
      root.classList.toggle("has-sel", n > 0);
      var oldBadge = elTrigger.querySelector(".umk-count");
      if (oldBadge) oldBadge.parentNode.removeChild(oldBadge);
      if (n === 1) {
        /* Exactly one market: its LOGO replaces the stack icon and its name replaces the word,
           so the trigger states the filter instead of counting it. */
        var m = byKey(selected[0]);
        elLabel.textContent = m ? nameOf(m) : "1 Market";
        if (lastTrigKey !== selected[0]) {
          lastTrigKey = selected[0];
          elTrigIc.innerHTML = m ? flagHtml(m, "umk-trigger-flag") : ICON.pin;
          wireFlags(elTrigIc);
        }
      } else {
        elLabel.textContent = "Markets";
        if (lastTrigKey !== null) { lastTrigKey = null; elTrigIc.innerHTML = ICON.pin; }
        /* From two selections up, a filled counter disc. Fixed width, so the trigger does not
           change size between 2 and 12. */
        if (n > 1) {
          var b = document.createElement("span");
          b.className = "umk-count";
          b.textContent = String(n);
          elTrigger.insertBefore(b, elTrigger.querySelector(".umk-chev"));
        }
      }
    }
    function renderMode() {
      var opts = elMode.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < opts.length; i++) {
        opts[i].classList.toggle("is-active", opts[i].getAttribute("data-mode") === mode);
      }
      root.classList.toggle("is-single", mode === "single");
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
        market_codes: selected.join(","),
        select_mode: mode,
        count: selected.length
      };
      /* Same team_id every other event carries -- lets the receiving workflow drop a payload that
         belongs to a team the page has since navigated away from. */
      try { var tid = UC.getTeam && UC.getTeam(); if (tid) payload.team_id = tid; } catch (e) {}
      var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }

      /* TWO channels, for the same reason the topics picker has two:
           data-markets-fn        the element INSIDE the reusable -- it owns the selection and puts
                                 market_codes / select_mode into the reusable's own states.
           data-markets-apply-fn  an element ON THE PAGE -- it is what tells the table to reload.
                                 A reusable cannot trigger a page-level workflow by itself.
         Fired in that order, both receiving the identical JSON. Optional: no attribute, no call. */
      if (!isLocal()) {
        var mainFn = root.getAttribute("data-markets-fn") || "bubble_fn_umkMarkets";
        fireTo(mainFn, json, true, "data-markets-fn");
        fireTo(applyFnName(mainFn), json, false, "data-markets-apply-fn");
      }
      try { root.dispatchEvent(new CustomEvent("umk-markets", { detail: payload, bubbles: true })); } catch (e) {}
    }

    /* The page-level channel. An explicit data-markets-apply-fn always wins; with the attribute left
       empty the name is DERIVED from data-markets-fn by swapping umkMarkets for umkApply:

         bubble_fn_umkMarkets_prompts   ->   bubble_fn_umkApply_prompts

       That is exactly the convention the Bubble file documents, so deriving it costs nothing and
       saves editing a second attribute on every placement (there are eleven of them on this app).
       It is a convention, not magic: if the derived name has no element behind it, fireTo warns by
       name instead of doing nothing, so a missing element still says so. A placement that wants a
       different name just sets the attribute. */
    function applyFnName(mainFn) {
      var explicit = (root.getAttribute("data-markets-apply-fn") || "").trim();
      if (explicit) return explicit;
      return mainFn.indexOf("umkMarkets") >= 0 ? mainFn.replace("umkMarkets", "umkApply") : "";
    }

    /* data-local="yes": the selection never leaves the page; the host reads the DOM event below.
       Without it an unset data-markets-fn falls back to bubble_fn_umkMarkets and a purely local
       picker would start poking whatever workflow owns that name on the page. */
    function isLocal() { return isYes(root.getAttribute("data-local")); }

    /* An UNSET apply channel used to return here without a word, which is the worst of the three
       outcomes: a name that is wrong warns, a name that works fires, and a name that was never
       filled in did nothing at all and looked exactly like a broken component. Said once per
       instance now, not on every click. */
    var warnedApply = false;
    function fireTo(name, json, required, label) {
      if (!name) {
        if (!required && !warnedApply && window.console) {
          warnedApply = true;
          console.info("[markets-filter] " + instanceId + ": no page-level channel. " + label + " is " +
            "empty and data-markets-fn does not contain \"umkMarkets\", so no name could be derived " +
            "either. Set " + label + " on the root div to the event that reloads the page, e.g. " +
            "\"bubble_fn_umkApply_prompts\".");
        }
        return;
      }
      var fn = UC.resolveBubbleFn(name);
      if (typeof fn === "function") { try { fn(json); } catch (e) {} return; }
      if (window.console) {
        console.warn("[markets-filter] " + name + " not found. This change reached no Bubble workflow." +
          (required ? "" : " (" + label + ")"));
      }
    }

    /* Everything a click can change: the ticks, the trigger, the footer. NOT the list markup. */
    function commit() { persist(); syncRows(); renderTrigger(); renderMode(); emit(); }

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
        /* Deliberately NOT focused -- see topics-filter.js for the reasoning. */
      } else {
        setSortOpen(false);
        /* Only rebuild when the query actually had something in it. Closing a panel nobody typed
           into would otherwise throw the identical markup away and take the logos with it. */
        var hadQuery = !!query;
        query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
        if (hadQuery) renderList();
        if (unregister) { unregister(); unregister = null; }
      }
    }
    function setSortOpen(v) {
      sortOpen = v;
      elSort.classList.toggle("is-open", sortOpen);
      /* Registered too, so the core rule closes it on the next unrelated dropdown -- and keeps the
         markets panel up, because that one contains this one. */
      if (sortOpen && UC.dropdownOpened) UC.dropdownOpened(elSortMenu, function () { setSortOpen(false); }, elSort);
    }

    /* ---------------- interactions ---------------- */
    elTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      /* The chevron doubles as a clear button while a filter is active. Same effect as Clear in
         the panel, and it deliberately does NOT toggle the panel: someone aiming at an X wants the
         filter gone, not a dropdown opened or closed under their cursor.
         Checked against the CLASS, not against a hover query: :hover cannot be read reliably on a
         touch device, and there the X is simply never shown, so the condition is false anyway. */
      var onX = false;
      try { onX = !!(e.target.closest && e.target.closest(".umk-chev-x")); } catch (err) {}
      if (onX && root.classList.contains("has-sel")) {
        selected = [];
        commit();
        return;
      }
      setOpen(!open);
    });
    elMenu.addEventListener("click", function (e) {
      e.stopPropagation();
      if (sortOpen && !elSort.contains(e.target)) setSortOpen(false);
    });
    /* A body-mounted overlay is not "outside" -- same exemption the topics picker carries. */
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
      var rows = elList.querySelectorAll(".umk-opt");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!rows.length) return;
        e.preventDefault();
        cursor = (e.key === "ArrowDown" ? cursor + 1 : cursor - 1);
        if (cursor < 0) cursor = rows.length - 1;
        if (cursor >= rows.length) cursor = 0;
        syncRows();
        var cur = elList.querySelector(".umk-opt.is-cursor");
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && cursor >= 0 && rows[cursor]) {
        e.preventDefault();
        toggle(rows[cursor].getAttribute("data-key"));
      }
    });

    elSearchIn.addEventListener("input", function () {
      query = String(elSearchIn.value || "").trim();
      elSearch.classList.toggle("has-text", !!elSearchIn.value.length);
      cursor = -1;
      renderList();
    });

    root.querySelector(".umk-search-x").addEventListener("click", function (e) {
      e.stopPropagation();
      query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
      cursor = -1; renderList(); try { elSearchIn.focus(); } catch (e2) {}
    });
    root.querySelector(".umk-sort-btn").addEventListener("click", function (e) {
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
      applyMode(b.getAttribute("data-mode"), true);
    });

    /* Switching Multi -> Single with several markets selected has to drop some of them, and the
       one that survives is THE LAST SELECTED. Rationale: selected[] is in click order, so the last
       entry is the market the user reached for most recently -- keeping the first instead would
       discard the newest decision, and keeping "whichever sorts first" would be arbitrary. The
       drop is a real selection change, so it publishes like any other. */
    function applyMode(next, publish) {
      next = (String(next).toLowerCase() === "single") ? "single" : "multi";
      var dropped = false;
      if (next === mode && !(next === "single" && selected.length > 1)) return;
      mode = next;
      if (mode === "single" && selected.length > 1) {
        selected = [selected[selected.length - 1]];
        dropped = true;
      }
      persist(); syncRows(); renderTrigger(); renderMode();
      if (publish || dropped) emit();
    }

    function toggle(k) {
      if (!k) return;
      var i = selected.indexOf(k);
      if (i >= 0) {
        selected.splice(i, 1);
      } else if (mode === "single") {
        /* Single mode: a second pick REPLACES the first rather than being refused. A click that
           visibly does nothing reads as a broken control, and "replace" is what every radio-like
           list in this app does. */
        selected = [k];
      } else {
        selected.push(k);
      }
      commit();
    }
    elList.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".umk-opt") : null;
      if (!b) return;
      toggle(b.getAttribute("data-key"));
    });

    root.querySelector(".umk-clear").addEventListener("click", function () {
      if (!selected.length) return;
      selected = [];
      commit();
    });

    /* ---------------- attributes ---------------- */
    function syncConfig() {
      var wantDark = isYes(root.getAttribute("data-isdark"));
      if (wantDark !== isDark) { isDark = wantDark; }
      if (isDark) root.setAttribute("data-theme", "dark");
      else if (root.getAttribute("data-theme") !== "dark" || root.hasAttribute("data-isdark")) root.removeAttribute("data-theme");
      /* is-processing is PURELY cosmetic -- it neither closes the panel nor blocks a click, for
         the reasons written out in topics-filter.js: closing on the flag made picking two markets
         in a row impossible, and a pointer-events lock turned one stuck "yes" into a dead control.
         emit() always sends the COMPLETE selection, so a click mid-refresh cannot desync anything. */
      root.classList.toggle("is-processing", isYes(root.getAttribute("data-isprocessing")));
    }
    try {
      new MutationObserver(syncConfig).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-isprocessing"]
      });
    } catch (e) {}
    if (UC.unclipAncestors) UC.unclipAncestors(root);
    /* The app's shared tooltip, so the Single/Multi hints look and time like every other tooltip.
       It reads isDark through a getter rather than a value because the theme can flip long after
       mount, and a tooltip built at boot would otherwise keep the theme it was born with. */
    if (UC.makeTooltips) UC.makeTooltips(root, function () { return isDark; });

    var ctrl = {
      root: root,
      instanceId: instanceId,
      setMarkets: function (rows) {
        markets = Array.isArray(rows) ? rows.slice() : [];
        /* Drop selections whose market no longer exists, otherwise the trigger counts something the
           list cannot show and Clear is the only way out. */
        var keys = {};
        markets.forEach(function (m) { keys[keyOf(m)] = 1; });
        var before = selected.length;
        selected = selected.filter(function (k) { return keys[k]; });
        persist(); render();
        if (selected.length !== before) emit();
      },
      setSelected: function (csv) {
        selected = String(csv == null ? "" : csv).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
        /* Honour the mode even when Bubble hands over more than one key in single mode -- the
           control must never display a state it would not let the user create. */
        if (mode === "single" && selected.length > 1) selected = [selected[selected.length - 1]];
        /* Same reasoning as commit: a selection arriving from Bubble is not a new list either. */
        persist(); syncRows(); renderTrigger(); renderMode();   // silent: mirrors state Bubble has
      },
      setMode: function (m) { applyMode(m, false); },    // silent unless it had to drop a selection
      setTheme: function (t) { isDark = (String(t).toLowerCase() === "dark"); syncConfig(); render(); },
      reset: function () {
        selected = []; mode = "multi"; query = "";
        elSearchIn.value = ""; elSearch.classList.remove("has-text");
        setOpen(false); persist(); render();             // SILENT, like every other reset in the repo
      },
      getSelected: function () { return { market_codes: selected.join(","), select_mode: mode }; }
    };
    root.__umkCtrl = ctrl;
    CONTROLLERS.push(ctrl);

    syncConfig();
    /* Order matters: the page-wide store WINS over the seed block. The seed is the value baked into
       the markup at page build, right for the first paint -- but if a "Load Markets" step already
       ran, the store holds the newer list and the seed would be a step backwards. */
    var fromStore = UC.getMarkets ? UC.getMarkets() : [];
    if (fromStore && fromStore.length) markets = fromStore;
    else if (seeded) markets = Array.isArray(seeded) ? seeded : [];
    render();

    /* ...and stay subscribed, so one setUpstreemMarkets() call updates every picker on the page --
       including this one if it mounts later, which is the case a per-instance setter could never
       reach. Selection survives: setMarkets keeps keys that are still in the list. */
    /* ...and stay subscribed. Also the receiving end of UC.marketsChanged(): a workflow that added
       or deleted a prompt calls it, the page re-runs the RPC and calls setUpstreemMarkets, and
       every picker on the page gets the new list AND the new prompt counts without knowing about
       each other. */
    if (UC.onMarkets) UC.onMarkets(function (list) { ctrl.setMarkets(list); }, root);

    for (var pid in PENDING) {
      if (!Object.prototype.hasOwnProperty.call(PENDING, pid)) continue;
      if (instanceId !== pid && instanceId.indexOf(pid) !== 0) continue;
      var pfn = PENDING[pid];
      delete PENDING[pid];
      try { pfn(ctrl); } catch (e) {
        if (window.console) console.error("[markets-filter] queued call for \"" + pid + "\" failed:", e);
      }
    }
    return ctrl;
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".umk-root, [data-umk-root]"), function (r) {
      try { initRoot(r); }
      catch (e) {
        if (window.console) console.error("[markets-filter] mount failed for instance \"" +
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
        var roots = document.querySelectorAll(".umk-root, [data-umk-root]");
        var ids = [];
        for (var i = 0; i < roots.length; i++) ids.push(roots[i].getAttribute("data-instance") || "(no data-instance)");
        console.warn("[markets-filter] \"" + id + "\" not mounted yet — queued, will run when it appears." +
          "  Mounted: " + (CONTROLLERS.map(function (c) { return c.instanceId; }).join(", ") || "none") +
          "  |  .umk-root elements in the DOM: " + roots.length + (ids.length ? " (" + ids.join(", ") + ")" : ""));
      }
    }
    return hit;
  }

  window.setMarketsFilterMarkets = function (instanceId, rows) {
    initAll();
    /* parseLoose, not JSON.parse: a display name can carry the same unescaped quote that took the
       urls-table down, and a bare JSON.parse in a try/catch would swallow the whole list. */
    var list = rows;
    if (typeof list === "string") list = (UC.parseLoose ? UC.parseLoose(list, "markets-filter") : null) || [];
    return forEachInstance(instanceId, function (c) { c.setMarkets(list); });
  };
  window.setMarketsFilterSelected = function (instanceId, csv) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setSelected(csv); });
  };
  window.setMarketsFilterMode = function (instanceId, m) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setMode(m); });
  };
  window.setMarketsFilterTheme = function (instanceId, t) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setTheme(t); });
  };
  window.resetMarketsFilter = function (instanceId) {
    initAll(); return forEachInstance(instanceId, function (c) { c.reset(); });
  };

  /* On-page diagnosis for the one question this component gets asked: "why did my workflow not
     run". Prints what each instance actually reads off its own root and whether the two names
     resolve to a live function right now, which is the whole chain in one line. */
  window.__umkDebug = function () {
    var roots = document.querySelectorAll(".umk-root, [data-umk-root]");
    var out = [];
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      var fnName = r.getAttribute("data-markets-fn") || "bubble_fn_umkMarkets";
      var explicit = (r.getAttribute("data-markets-apply-fn") || "").trim();
      var apply = explicit || (fnName.indexOf("umkMarkets") >= 0 ? fnName.replace("umkMarkets", "umkApply") : "");
      out.push({
        instance: r.getAttribute("data-instance"),
        local: r.getAttribute("data-local") || "(unset)",
        marketsFn: fnName,
        marketsFnLive: typeof UC.resolveBubbleFn(fnName) === "function",
        applyFn: apply ? (apply + (explicit ? "" : " (derived)")) : "(none)",
        applyFnLive: apply ? typeof UC.resolveBubbleFn(apply) === "function" : false,
        selected: r.__umkCtrl ? r.__umkCtrl.getSelected() : "(not mounted)",
        marketsLoaded: (UC.getMarkets ? UC.getMarkets().length : 0)
      });
    }
    if (window.console) console.table ? console.table(out) : console.log(out);
    return out;
  };

  initAll();
  if (UC.watchRoots) UC.watchRoots("umk-root", initAll);

  if (Q && Q.length) {
    Q.splice(0, Q.length).forEach(function (entry) {
      try { window[entry[0]].apply(null, entry[1]); }
      catch (e) { if (window.console) console.error("[markets-filter] queued " + entry[0] + " failed:", e); }
    });
  }
})();
