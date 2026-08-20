/* upstreem models-filter.js — the LLM Models filter dropdown (prefix `umf`).
   Load core.js first.

   Built as a deliberate twin of topics-filter.js: same multi-instance contract, same boot-stub
   queue, same "every click publishes the FULL state, never a delta" rule, same page-wide store
   feeding every instance. Where the two differ, it is because the data differs -- and each of
   those places says so.

   Differences from the topics picker, all of them requested:
     - No "Add Model" button. Models are config, not user data; nothing here creates one.
     - The footer switcher is SINGLE vs MULTI select, not Or/And. Or/And describes how a filter
       COMBINES several values; single/multi decides whether several can exist at all, so it also
       has to enforce that (see setMode).
     - The trigger shows the model's LOGO when exactly one is selected, where the topics picker
       shows a colour dot -- a model is recognised by its mark, a topic by its colour.
     - Sort is Provider / Name. There is no usage count on a model to sort by. */
(function () {
  var UC = window.UpstreemCore;
  /* ---- Boot-Stubs, VOR der core-Pruefung ------------------------------------------
     Frueher stand dieser Block DAHINTER: war core.js noch nicht da, kehrte die Datei
     vorher zurueck und legte gar keine Stubs an -- genau der Fall, fuer den sie da sind.
     Als "setUpstreemDefaultMarket is not defined" in add-prompts real geworden.
     Die Stubs brauchen UC nicht, sie merken einen Aufruf nur vor. */
  var API_NAMES = ["setModelsFilterModels", "resetModelsFilter", "setModelsFilterSelected",
                   "setModelsFilterMode", "setModelsFilterTheme"];
  var Q = (window.__umfBootQueue = window.__umfBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  /* Nicht aufgeben: Bubble haengt die Skripte per jQuery .html() ein, die Reihenfolge ist
     nicht garantiert. Ein einmaliger Fehlschlag hiess bisher: Komponente tot bis zum
     Neuladen. Gleiche Bauart wie in date-range.js. */
  if (!UC) {
    (function warte(n){
      if (window.UpstreemCore){ UC = window.UpstreemCore; umfStart(); return; }
      if (n <= 0){ if (window.console) console.error("UpstreemCore (core.js) not loaded"); return; }
      setTimeout(function(){ warte(n - 1); }, 100);
    })(30);
    return;
  }

  function umfStart(){

  /* ---- boot stubs (STYLEGUIDE §25) --------------------------------------------------------
     Bubble fires workflows before this file finishes loading. The names have to exist from the
     first tick and replay in call order. */
  /* setUpstreemModels lives in core.js -- but core.js can still be in flight when Bubble fires its
     "Load Models" step. Stub it into the queue core drains the moment it defines the real one.
     Only installed if nothing owns the name yet: if core.js already loaded, the real one stays. */
  if (!window.setUpstreemModels) {
    window.setUpstreemModels = function (rows) {
      (window.__upModelsQueue = window.__upModelsQueue || []).push(rows);
    };
  }


  var CONTROLLERS = [];
  /* Die Warteschlange fuer Aufrufe an eine noch nicht gebaute Instanz steht jetzt in core
     (UC.makeLate). Sie stand hier viermal fast gleich -- und in allen vier Kopien mit zwei
     Schwaechen: nur EIN Aufruf je id (der zweite ueberschrieb den ersten) und kein Verfall,
     also hielt eine id, die nie erscheint, ihre Aufrufe fuer immer fest. */
  var spaet = UC.makeLate ? UC.makeLate("models-filter", ".umf-root, [data-umf-root]") : null;
  /* Survives a Bubble re-render of the element, keyed by instance: a rebuilt element must continue
     the filter, not restart it. */
  var STATE = (window.__umfStore = window.__umfStore || {});
  /* URLs, die schon einmal erfolgreich geladen haben. Auf window, weil zwei data-cdn-pin-Werte
     diese Datei zweimal laden koennen und beide Kopien vom selben Wissen profitieren sollen.
     Beim echten Neuaufbau (neue Modelliste) wird die Kachel damit gar nicht erst gezeigt: das
     Bild liegt im Browser-Cache, hat aber trotzdem keinen Zustand, den das frische Markup kennt. */
  var LOGO_OK = (window.__umfLogoOk = window.__umfLogoOk || {});

  var ICON = {
    /* Feather "layers" -- the stack glyph. Feather has no icon literally called stack; layers is
       the one that reads as a stack of models and is what the rest of the app already ships. */
    stack: '<svg viewBox="0 0 24 24"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" /></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>',
    search: '<svg viewBox="0 0 24 24"><path d="m21 21-4.34-4.34" /> <circle cx="11" cy="11" r="8" /></svg>',
    /* Same clear-X core's search fields use, stroke-width and all. */
    x: '<svg viewBox="0 0 24 24" stroke-width="3.5"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
    /* Feather "x" at its own stroke weight, for the clear-X that replaces the chevron on hover.
       The one above is the SEARCH field's clear icon and deliberately heavier (3.5) because it
       sits inside an input at a smaller optical size. Reusing it on the trigger made a chunky
       cross next to a 1.8-weight chevron. */
    xThin: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
    /* Sortieren: arrow-down-up aus core, dieselbe Form wie an jedem Sortierknopf der Toolbars.
       Hier standen drei zur Mitte schmaler werdende Linien -- die Filterform, nicht die
       Sortierform, und damit trug ein Filter-Menue zwei verschiedene Zeichen fuer zwei
       verschiedene Dinge, die gleich aussahen. */
    sort: UC.icon("arrowUpDown", 2),
    /* core's CHECK_SVG verbatim, so the tick matches every other checked row in the app. */
    check: UC.icon("check", 3),
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
    { key: "provider", label: "Provider" },
    { key: "name",     label: "Name" }
  ];
  var DEFAULT_SORT = "provider";

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
    if (root.__umfCtrl) {
      if (CONTROLLERS.indexOf(root.__umfCtrl) < 0) CONTROLLERS.push(root.__umfCtrl);
      return root.__umfCtrl;
    }

    var instanceId = String(root.getAttribute("data-instance") || "").trim() ||
                     ("umf-" + Math.random().toString(36).slice(2, 10));
    root.setAttribute("data-instance", instanceId);

    var saved = STATE[instanceId] || {};
    var models = [];                                  // full list as delivered
    /* SELECTION ORDER MATTERS here in a way it does not for topics: switching Multi -> Single has
       to keep exactly one, and "the one picked last" is the only choice that matches what the user
       just did. push() on select therefore has to stay push -- never unshift, never a re-sort. */
    var selected = saved.selected ? saved.selected.slice() : [];
    var mode = (saved.mode === "single") ? "single" : "multi";
    var sortKey = saved.sortKey || DEFAULT_SORT;
    var query = "";
    var open = false, sortOpen = false, cursor = -1;
    var isDark = false;

    /* Models authored straight into the element, so a page needs no Run-JavaScript step at all.
       Read BEFORE the innerHTML assignment below, which would otherwise destroy the block.
       type="application/json" on purpose: the browser does not execute it, so the array can carry
       anything a display name might contain without being parsed as code. A later
       setModelsFilterModels()/setUpstreemModels() simply replaces whatever was seeded here. */
    var seeded = null;
    var seedEl = root.querySelector(".umf-models-json");
    if (seedEl) {
      var raw = String(seedEl.textContent || "").trim();
      /* Any bare ALL-CAPS token is an unreplaced Bubble placeholder, not data. Checking for one
         specific name was the bug: markets-filter was derived from models-filter and kept looking
         for MODELS_JSON, so MARKETS_JSON sailed through and every mount logged a parse error for
         a state that is completely normal — the seed is empty whenever the page feeds the list
         through setUpstreemMarkets() instead. Matching the SHAPE covers all three pickers and any
         future one. */
      if (raw && !/^[A-Z0-9_]+$/.test(raw)) {
        seeded = UC.parseLoose ? UC.parseLoose(raw, "models-filter " + instanceId) : null;
      }
    }

    root.classList.add("umf-root");
    root.innerHTML =
      '<div class="umf-wrap">' +
        '<button class="umf-trigger" type="button" aria-haspopup="listbox" aria-expanded="false">' +
          '<span class="umf-trigger-ic">' + ICON.stack + '</span>' +
          '<span class="umf-label">Models</span>' +
          /* Both glyphs live in the DOM; CSS swaps them on hover once something is selected.
             Rendering the X only on hover through JS would need mouseenter/mouseleave on a node
             that gets rebuilt on every selection change, and the two would drift apart. */
          '<span class="umf-chev">' +
            '<span class="umf-chev-down">' + ICON.chev + '</span>' +
            '<span class="umf-chev-x" role="button" tabindex="-1" aria-label="Clear selection">' + ICON.xThin + '</span>' +
          '</span>' +
        '</button>' +
        '<div class="umf-menu" role="dialog">' +
          /* Search row: input with the magnifier INSIDE on the right, Clear as its own button
             beside it -- the shape the app already uses. */
          '<div class="umf-search-row">' +
            '<span class="up-ddsearch umf-search">' +
              '<input class="up-ddsearch-in umf-search-in" type="text" placeholder="Search models" aria-label="Search models">' +
              '<span class="up-ddsearch-ic">' + ICON.search + '</span>' +
              '<button class="up-ddsearch-x umf-search-x" type="button" aria-label="Clear search">' + ICON.x + '</button>' +
            '</span>' +
            '<span class="umf-sort">' +
              '<button class="umf-sort-btn" type="button" aria-label="Sort models" data-tip="Sort models">' + ICON.sort + '</button>' +
              '<div class="umf-sort-menu" role="menu"></div>' +
            '</span>' +
            '<button class="umf-clear" type="button">Clear</button>' +
          '</div>' +
          '<div class="umf-list" role="listbox" aria-multiselectable="true"></div>' +
          '<div class="umf-foot">' +
            /* core's .up-seg / .up-seg-btn -- the app's switcher, not a copy of it. Icon on top,
               label underneath, which is what "Icons mit Tooltips darunter" asks for and also
               keeps both buttons the same width regardless of word length. */
            '<span class="up-seg umf-seg" role="group" aria-label="Selection mode">' +
              '<button class="up-seg-btn umf-seg-btn" type="button" data-mode="single"' +
                ' aria-label="Single select" data-tip="Single select. Picking another model replaces the current one.">' +
                '<span class="umf-seg-ic">' + ICON.single + '</span>' +
              '</button>' +
              '<button class="up-seg-btn umf-seg-btn" type="button" data-mode="multi"' +
                ' aria-label="Multi select" data-tip="Multi select. Combine several models in one filter.">' +
                '<span class="umf-seg-ic">' + ICON.multi + '</span>' +
              '</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>';

    var elWrap    = root.querySelector(".umf-wrap");
    var elTrigger = root.querySelector(".umf-trigger");
    var elTrigIc  = root.querySelector(".umf-trigger-ic");
    var elLabel   = root.querySelector(".umf-label");
    var elMenu    = root.querySelector(".umf-menu");
    var elSearch  = root.querySelector(".umf-search");
    var elSearchIn= root.querySelector(".umf-search-in");
    var elSort    = root.querySelector(".umf-sort");
    var elSortMenu= root.querySelector(".umf-sort-menu");
    var elMode    = root.querySelector(".umf-foot");
    var elList    = root.querySelector(".umf-list");
    var unregister = null;

    /* ---------------- data helpers ---------------- */
    function keyOf(m) { return String(m && m.key != null ? m.key : ""); }
    function nameOf(m) { return String((m && (m.display_name || m.name || m.key)) || ""); }
    function isSel(k) { return selected.indexOf(k) >= 0; }
    function byKey(k) {
      for (var i = 0; i < models.length; i++) if (keyOf(models[i]) === k) return models[i];
      return null;
    }
    /* Inactive models stay in the list instead of vanishing from it. A model that was switched off
       is still part of the vocabulary, and hiding it makes an older saved filter referring to it
       look like a bug rather than a deliberate state. They sort to the BOTTOM, render dimmed, and
       cannot be picked (see toggle) -- visible as context, not as a choice. */
    /* Tolerant on purpose. A strict `!== false` only catches a real boolean, and Bubble hands this
       field over as TEXT more often than not: "no", "false", "0", or an empty string all mean
       inactive and all of them are truthy in JavaScript. That mismatch is why the inactive block
       looked like it was not working at all -- every model came back active. */
    function isActive(m) {
      var v = m ? m.is_active : undefined;
      if (v === undefined || v === null || v === "") return true;   // field absent: assume active
      if (v === false || v === 0) return false;
      if (v === true || v === 1) return true;
      var t = String(v).trim().toLowerCase();
      return !(t === "false" || t === "no" || t === "0" || t === "off" || t === "inactive");
    }
    function visible() {
      var q = query.toLowerCase();
      var list = models.filter(function (m) {
        if (!q) return true;
        /* Provider is searchable too: typing "openai" should find the whole family, which is how
           anyone actually looks for a model. */
        return (nameOf(m) + " " + String(m.provider || "")).toLowerCase().indexOf(q) >= 0;
      });
      list.sort(function (a, b) {
        /* Active before inactive, always, whatever the sort key says. The sort key then orders
           inside each of the two blocks. */
        var act = (isActive(a) ? 0 : 1) - (isActive(b) ? 0 : 1);
        if (act !== 0) return act;
        if (sortKey === "name") return nameOf(a).localeCompare(nameOf(b));
        /* Provider first, then name inside it -- otherwise models from one provider scatter and
           the grouping the sort promises is not visible. */
        var p = String(a.provider || "").localeCompare(String(b.provider || ""));
        return p !== 0 ? p : nameOf(a).localeCompare(nameOf(b));
      });
      return list;
    }

    /* ---------------- render ---------------- */
    function renderSortMenu() {
      elSortMenu.innerHTML = SORTS.map(function (s) {
        return '<button class="up-optrow umf-sort-opt' + (s.key === sortKey ? " is-on" : "") +
               '" type="button" role="menuitem" data-sort="' + s.key + '">' + esc(s.label) +
               '<span class="up-optrow-check">' + ICON.check + '</span></button>';
      }).join("");
    }
    /* A logo that fails to load must not leave a broken-image glyph in a filter row, so the initial
       on a neutral tile sits underneath as a fallback.

       The tile is REMOVED again once the image actually loads. Leaving it visible was the bug: a
       model logo is usually a transparent PNG, so the grey square showed through everywhere the
       artwork was not opaque, and every row carried a visible box behind its logo. The tile now
       only survives where it is genuinely needed, which is no URL or a URL that failed.

       Wired in JS rather than as an inline onerror/onload attribute: the handlers have to cope
       with an image that is ALREADY complete by the time the markup lands (a cached logo fires
       neither event), and that check has nowhere to live in an attribute. */
    function logoHtml(m, cls) {
      var url = fixUrl(m.logo_url);
      var initial = esc(nameOf(m).charAt(0).toUpperCase() || "?");
      if (url && LOGO_OK[url]) cls += " has-img";
      return '<span class="' + cls + ' umf-logo">' +
               '<span class="umf-logo-fb">' + initial + '</span>' +
               (url ? '<img class="umf-logo-img" src="' + esc(url) + '" alt="" loading="lazy">' : '') +
             '</span>';
    }
    function wireLogos(scope) {
      if (!scope) return;
      var imgs = scope.querySelectorAll(".umf-logo-img");
      for (var i = 0; i < imgs.length; i++) (function (img) {
        if (img.__umfWired) return;
        img.__umfWired = true;
        function ok(){ var p = img.parentNode; if (p) p.classList.add("has-img"); LOGO_OK[img.src] = 1; }
        function bad(){ img.style.display = "none"; var p = img.parentNode; if (p) p.classList.remove("has-img"); }
        if (img.complete) { if (img.naturalWidth > 0) ok(); else bad(); return; }
        img.addEventListener("load", ok);
        img.addEventListener("error", bad);
      })(imgs[i]);
    }
    function optHtml(m, idx) {
      var k = keyOf(m);
      var on = isSel(k);
      var off = !isActive(m);
      return '<div class="up-filter-item umf-opt' + (on ? " is-checked" : "") + (idx === cursor ? " is-cursor" : "") +
             (off ? " is-inactive" : "") +
             '" role="option" tabindex="' + (off ? "-1" : "0") + '" aria-disabled="' + (off ? "true" : "false") +
             '" aria-selected="' + (on ? "true" : "false") +
             '" data-key="' + esc(k) + '" data-idx="' + idx + '">' +
               '<span class="up-filter-check">' + ICON.check + '</span>' +
               '<span class="umf-opt-main">' + logoHtml(m, "umf-opt-logo") +
                 '<span class="umf-opt-name">' + esc(nameOf(m)) + '</span>' +
               '</span>' +
               '<span class="umf-opt-provider">' + esc(m.provider || "") + '</span>' +
             '</div>';
    }
    function renderList() {
      var list = visible();
      if (!list.length) {
        elList.innerHTML = '<div class="umf-empty">' + (models.length ? "No models match" : "No models yet") + '</div>';
        return;
      }
      var i = 0, html = "";
      list.forEach(function (m) { html += optHtml(m, i++); });
      elList.innerHTML = html;
      wireLogos(elList);
    }
    /* Selection and cursor are CLASS changes, not a reason to rebuild the list.
       Rebuilding innerHTML threw every <img> away and created a new one, so on each click the
       logos went through their fallback tile again for a frame or two: that was the flicker.
       The row ORDER never depends on the selection (see visible), so nothing has to move here. */
    function syncRows() {
      var rows = elList.querySelectorAll(".umf-opt");
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
      var oldBadge = elTrigger.querySelector(".umf-count");
      if (oldBadge) oldBadge.parentNode.removeChild(oldBadge);
      if (n === 1) {
        /* Exactly one model: its LOGO replaces the stack icon and its name replaces the word,
           so the trigger states the filter instead of counting it. */
        var m = byKey(selected[0]);
        elLabel.textContent = m ? nameOf(m) : "1 Model";
        if (lastTrigKey !== selected[0]) {
          lastTrigKey = selected[0];
          elTrigIc.innerHTML = m ? logoHtml(m, "umf-trigger-logo") : ICON.stack;
          wireLogos(elTrigIc);
        }
      } else {
        elLabel.textContent = "Models";
        if (lastTrigKey !== null) { lastTrigKey = null; elTrigIc.innerHTML = ICON.stack; }
        /* From two selections up, a filled counter disc. Fixed width, so the trigger does not
           change size between 2 and 12. */
        if (n > 1) {
          var b = document.createElement("span");
          b.className = "umf-count";
          b.textContent = String(n);
          elTrigger.insertBefore(b, elTrigger.querySelector(".umf-chev"));
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
        model_keys: selected.join(","),
        select_mode: mode,
        count: selected.length
      };
      /* Same team_id every other event carries -- lets the receiving workflow drop a payload that
         belongs to a team the page has since navigated away from. */
      try { var tid = UC.getTeam && UC.getTeam(); if (tid) payload.team_id = tid; } catch (e) {}
      var json; try { json = JSON.stringify(payload); } catch (e) { json = ""; }

      /* TWO channels, for the same reason the topics picker has two:
           data-models-fn        the element INSIDE the reusable -- it owns the selection and puts
                                 model_keys / select_mode into the reusable's own states.
           data-models-apply-fn  an element ON THE PAGE -- it is what tells the table to reload.
                                 A reusable cannot trigger a page-level workflow by itself.
         Fired in that order, both receiving the identical JSON. Optional: no attribute, no call. */
      if (!isLocal()) {
        var mainFn = root.getAttribute("data-models-fn") || "bubble_fn_umfModels";
        fireTo(mainFn, json, true, "data-models-fn");
        fireTo(applyFnName(mainFn), json, false, "data-models-apply-fn");
      }
      try { root.dispatchEvent(new CustomEvent("umf-models", { detail: payload, bubbles: true })); } catch (e) {}
    }

    /* The page-level channel. An explicit data-models-apply-fn always wins; with the attribute left
       empty the name is DERIVED from data-models-fn by swapping umfModels for umfApply:

         bubble_fn_umfModels_prompts   ->   bubble_fn_umfApply_prompts

       That is exactly the convention the Bubble file documents, so deriving it costs nothing and
       saves editing a second attribute on every placement (there are eleven of them on this app).
       It is a convention, not magic: if the derived name has no element behind it, fireTo warns by
       name instead of doing nothing, so a missing element still says so. A placement that wants a
       different name just sets the attribute. */
    function applyFnName(mainFn) {
      var explicit = (root.getAttribute("data-models-apply-fn") || "").trim();
      if (explicit) return explicit;
      return mainFn.indexOf("umfModels") >= 0 ? mainFn.replace("umfModels", "umfApply") : "";
    }

    /* data-local="yes": the selection never leaves the page; the host reads the DOM event below.
       Without it an unset data-models-fn falls back to bubble_fn_umfModels and a purely local
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
          console.info("[models-filter] " + instanceId + ": no page-level channel. " + label + " is " +
            "empty and data-models-fn does not contain \"umfModels\", so no name could be derived " +
            "either. Set " + label + " on the root div to the event that reloads the page, e.g. " +
            "\"bubble_fn_umfApply_prompts\".");
        }
        return;
      }
      var fn = UC.resolveBubbleFn(name);
      if (typeof fn === "function") { try { fn(json); } catch (e) {} return; }
      if (window.console) {
        console.warn("[models-filter] " + name + " not found. This change reached no Bubble workflow." +
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
         models panel up, because that one contains this one. */
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
      try { onX = !!(e.target.closest && e.target.closest(".umf-chev-x")); } catch (err) {}
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
      var rows = elList.querySelectorAll(".umf-opt");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (!rows.length) return;
        e.preventDefault();
        cursor = (e.key === "ArrowDown" ? cursor + 1 : cursor - 1);
        if (cursor < 0) cursor = rows.length - 1;
        if (cursor >= rows.length) cursor = 0;
        syncRows();
        var cur = elList.querySelector(".umf-opt.is-cursor");
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

    root.querySelector(".umf-search-x").addEventListener("click", function (e) {
      e.stopPropagation();
      query = ""; elSearchIn.value = ""; elSearch.classList.remove("has-text");
      cursor = -1; renderList(); try { elSearchIn.focus(); } catch (e2) {}
    });
    root.querySelector(".umf-sort-btn").addEventListener("click", function (e) {
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
      /* publish=false: the switch itself is not a filter change. Single and Multi return the same
         rows as long as at most one model is selected, so the only case that reaches Bubble is the
         one where switching to Single actually DROPS selections -- applyMode emits on its own
         then. Firing on every click meant a workflow re-ran for a state it already had. */
      applyMode(b.getAttribute("data-mode"), false);
    });

    /* Switching Multi -> Single with several models selected has to drop some of them, and the
       one that survives is THE LAST SELECTED. Rationale: selected[] is in click order, so the last
       entry is the model the user reached for most recently -- keeping the first instead would
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
      var m = byKey(k);
      /* An inactive model is shown but not selectable. Checked here rather than by leaving the
         click handler unbound, so keyboard Enter is refused on the same rule as a mouse click. */
      if (m && !isActive(m)) return;
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
      var b = e.target.closest ? e.target.closest(".umf-opt") : null;
      if (!b) return;
      toggle(b.getAttribute("data-key"));
    });

    root.querySelector(".umf-clear").addEventListener("click", function () {
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
         the reasons written out in topics-filter.js: closing on the flag made picking two models
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
      setModels: function (rows) {
        models = Array.isArray(rows) ? rows.slice() : [];
        /* Drop selections whose model no longer exists, otherwise the trigger counts something the
           list cannot show and Clear is the only way out. */
        var keys = {};
        models.forEach(function (m) { keys[keyOf(m)] = 1; });
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
        /* Auch die gelieferte Liste raus, nicht nur die Auswahl: nach einem Team- oder
           Projektwechsel gehoeren die alten Modelle niemandem mehr, und eine Liste ohne
           passende Auswahl waere schlimmer als gar keine. Die Liste zeigt danach
           "No models yet"; der naechste Load fuellt sie wieder. Der seitenweite Store
           bleibt unangetastet -- an dem haengen auch andere Komponenten. */
        models = [];
        /* "Alles clearen" schliesst die Sortierung mit ein -- wie beim Datumsfilter, der
           auf seine Vorgabe zurueckgeht statt nur die Auswahl zu leeren. */
        sortKey = DEFAULT_SORT; sortOpen = false; cursor = -1;
        setOpen(false); persist(); render();             // SILENT, like every other reset in the repo
      },
      getSelected: function () { return { model_keys: selected.join(","), select_mode: mode }; }
    };
    root.__umfCtrl = ctrl;
    CONTROLLERS.push(ctrl);

    syncConfig();
    /* Order matters: the page-wide store WINS over the seed block. The seed is the value baked into
       the markup at page build, right for the first paint -- but if a "Load Models" step already
       ran, the store holds the newer list and the seed would be a step backwards. */
    var fromStore = UC.getModels ? UC.getModels() : [];
    if (fromStore && fromStore.length) models = fromStore;
    else if (seeded) models = Array.isArray(seeded) ? seeded : [];
    render();

    /* ...and stay subscribed, so one setUpstreemModels() call updates every picker on the page --
       including this one if it mounts later, which is the case a per-instance setter could never
       reach. Selection survives: setModels keeps keys that are still in the list. */
    if (UC.onModels) UC.onModels(function (list) { ctrl.setModels(list); }, root);

    if (spaet) spaet.drain(instanceId, ctrl);
    return ctrl;
  }

  function initAll() {
    Array.prototype.forEach.call(document.querySelectorAll(".umf-root, [data-umf-root]"), function (r) {
      try { initRoot(r); }
      catch (e) {
        if (window.console) console.error("[models-filter] mount failed for instance \"" +
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
    if (!hit && id && spaet) spaet.park(id, fn);
    return hit;
  }

  window.setModelsFilterModels = function (instanceId, rows) {
    initAll();
    /* parseLoose, not JSON.parse: a display name can carry the same unescaped quote that took the
       urls-table down, and a bare JSON.parse in a try/catch would swallow the whole list. */
    var list = rows;
    if (typeof list === "string") list = (UC.parseLoose ? UC.parseLoose(list, "models-filter") : null) || [];
    return forEachInstance(instanceId, function (c) { c.setModels(list); });
  };
  window.setModelsFilterSelected = function (instanceId, csv) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setSelected(csv); });
  };
  window.setModelsFilterMode = function (instanceId, m) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setMode(m); });
  };
  window.setModelsFilterTheme = function (instanceId, t) {
    initAll(); return forEachInstance(instanceId, function (c) { c.setTheme(t); });
  };
  window.resetModelsFilter = function (instanceId) {
    initAll(); return forEachInstance(instanceId, function (c) { c.reset(); });
  };

  /* On-page diagnosis for the one question this component gets asked: "why did my workflow not
     run". Prints what each instance actually reads off its own root and whether the two names
     resolve to a live function right now, which is the whole chain in one line. */
  window.__umfDebug = function () {
    var roots = document.querySelectorAll(".umf-root, [data-umf-root]");
    var out = [];
    for (var i = 0; i < roots.length; i++) {
      var r = roots[i];
      var fnName = r.getAttribute("data-models-fn") || "bubble_fn_umfModels";
      var explicit = (r.getAttribute("data-models-apply-fn") || "").trim();
      var apply = explicit || (fnName.indexOf("umfModels") >= 0 ? fnName.replace("umfModels", "umfApply") : "");
      out.push({
        instance: r.getAttribute("data-instance"),
        local: r.getAttribute("data-local") || "(unset)",
        modelsFn: fnName,
        modelsFnLive: typeof UC.resolveBubbleFn(fnName) === "function",
        applyFn: apply ? (apply + (explicit ? "" : " (derived)")) : "(none)",
        applyFnLive: apply ? typeof UC.resolveBubbleFn(apply) === "function" : false,
        selected: r.__umfCtrl ? r.__umfCtrl.getSelected() : "(not mounted)",
        modelsLoaded: (UC.getModels ? UC.getModels().length : 0)
      });
    }
    if (window.console) console.table ? console.table(out) : console.log(out);
    return out;
  };

  initAll();
  if (UC.watchRoots) UC.watchRoots("umf-root", initAll);

  if (Q && Q.length) {
    Q.splice(0, Q.length).forEach(function (entry) {
      try { window[entry[0]].apply(null, entry[1]); }
      catch (e) { if (window.console) console.error("[models-filter] queued " + entry[0] + " failed:", e); }
    });
  }
  }   /* Ende umfStart */

  umfStart();
})();
