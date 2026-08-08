/* upstreem date-range.js — the Date Range filter dropdown. Requires core.js (window.UpstreemCore).

   Ported from the standalone date-range picker. The BUBBLE CONTRACT IS UNCHANGED: the same three
   data-*-fn attributes, the same JSON payload with the same keys, the same two CustomEvents, and
   window.resetUpstreemDateRangePicker(instanceId) still works exactly as before.

   What changed against the standalone, all agreed up front:

   1. No Flatpickr. The calendar is this file's own ~120 lines instead of a third-party widget plus
      ~200 lines of !important overrides written to neutralise its styling. Nothing is fetched at
      runtime any more, and a Flatpickr release can no longer break the skin. Two behaviours are
      better as a side effect: the grid is always 6 rows, so the panel keeps its height when you
      page to a 5-row month, and the day cells are real <button>s, so keyboard users get them.
   2. The iframe-tree walk that hunted for bubble_fn_* across every reachable frame is gone.
      core's resolveBubbleFn already checks window/parent/top, which is what every other component
      in this repo uses.
   3. The 1200ms setInterval that re-scanned the DOM is gone. UC.watchRoots (MutationObserver)
      covers Bubble replacing the element, same as everywhere else.
   4. The panel is position:absolute inside its wrapper instead of body-mounted position:fixed with
      a JS reposition on scroll/resize. See the note in date-range.css — a JS scroll-follow is
      always a frame behind, which is exactly the drift core's makeFire comment describes.
   5. Colours come from core's --vc-* tokens. The standalone also wrote hex values inline with
      !important from JS on every hover, which meant the trigger did not follow a theme switch. */

(function () {
  "use strict";

  /* ---------- stubs ----------
     Bubble can call these before core.js has finished loading. Queue and replay in call order
     (STYLEGUIDE §25 step 2). */
  var API_NAMES = ["resetUpstreemDateRangePicker", "setDateRangePreset", "setDateRangeTheme"];
  var __udrQueue = window.__udrBootQueue = window.__udrBootQueue || [];
  if (!window.__udrBootStubbed) {
    window.__udrBootStubbed = true;
    API_NAMES.forEach(function (n) {
      if (typeof window[n] !== "function") {
        window[n] = function () { __udrQueue.push([n, arguments]); return true; };
      }
    });
  }

  function udrBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { udrBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;

    /* ---------- dates ----------
       Everything is a local midnight Date. No UTC anywhere: the picker means calendar days, and
       an ISO/UTC round trip is what shifts a range by one day for anyone east or west of the
       server. */
    function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
    function addDays(d, n) { var r = startOfDay(d); r.setDate(r.getDate() + n); return r; }
    function addMonths(d, n) {
      var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
      var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
      t.setDate(Math.min(d.getDate(), last));
      return startOfDay(t);
    }
    function minD(a, b) { return a.getTime() <= b.getTime() ? a : b; }
    function maxD(a, b) { return a.getTime() >= b.getTime() ? a : b; }
    function sameDay(a, b) { return a && b && a.getTime() === b.getTime(); }
    function iso(d) {
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
             String(d.getDate()).padStart(2, "0");
    }
    function parseIso(v) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
      if (!m) return null;
      var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return isNaN(d.getTime()) ? null : startOfDay(d);
    }
    var MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    var MONTHS_LONG  = ["January","February","March","April","May","June","July","August",
                        "September","October","November","December"];
    var DOWS = ["Mo","Tu","We","Th","Fr","Sa","Su"];
    function displayDate(d) {
      return String(d.getDate()).padStart(2, "0") + ". " + MONTHS_SHORT[d.getMonth()] + " " + d.getFullYear();
    }
    function rangeLabel(a, b) { return displayDate(a) + " – " + displayDate(b); }

    var PRESETS = [
      { key: "last7",  label: "Last 7 Days"   },
      { key: "last30", label: "Last 30 Days"  },
      { key: "last3",  label: "Last 3 Months" },
      { key: "last6",  label: "Last 6 Months" }
    ];
    var DEFAULT_PRESET = "last7";

    var ICON_CAL  = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
    var ICON_CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    function navIcon(dir) {
      var pts = dir === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6";
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="' + pts + '"/></svg>';
    }

    /* Survives Bubble swapping the element out and back in on a page change: the picker comes
       back showing what the user last chose instead of snapping to the default. Keyed by
       data-instance, deliberately in memory only -- a stale range restored from localStorage days
       later is worse than the default. */
    var STATE = window.__udrState || (window.__udrState = Object.create(null));
    var CONTROLLERS = [];

    function initRoot(root) {
      if (!root || root.__udrInit) return root && root.__udrCtrl;
      root.__udrInit = true;

      var MIN_DATE = parseIso(root.getAttribute("data-min-date")) || new Date(2024, 0, 1);
      var TODAY = startOfDay(new Date());
      /* How far a range may span. The second click is clamped to ±this from the first, so a user
         cannot accidentally ask the backend for three years of rows. */
      var MAX_SPAN_MONTHS = Number(root.getAttribute("data-max-span-months")) || 6;

      var instanceId = String(root.getAttribute("data-instance") || "").trim() ||
                       ("udr-" + Math.random().toString(36).slice(2, 10));
      root.setAttribute("data-instance", instanceId);

      var committed = presetRange(DEFAULT_PRESET);
      var committedPreset = DEFAULT_PRESET;
      var committedLabel = "Last 7 Days";
      var pendingStart = null;     // first click of a new range, nothing committed yet
      var hoverDate = null;        // drives the live range preview
      var viewMonth = null;        // left-hand month currently rendered
      var emitSeq = 0;

      var saved = STATE[instanceId];
      if (saved && saved.from && saved.to) {
        var sf = parseIso(saved.from), st = parseIso(saved.to);
        if (sf && st) {
          committed = { from: maxD(MIN_DATE, sf), to: minD(TODAY, st) };
          committedPreset = saved.preset || null;
          committedLabel = saved.label || rangeLabel(committed.from, committed.to);
        }
      }

      root.classList.add("up-root", "udr-root");
      root.innerHTML =
        '<div class="udr-wrap">' +
          '<button class="udr-trigger" type="button" aria-haspopup="dialog" aria-expanded="false">' +
            ICON_CAL + '<span class="udr-label"></span>' + ICON_CHEV.replace('<svg ', '<svg class="udr-chev" ') +
          '</button>' +
          '<div class="udr-menu" role="dialog" aria-label="Choose date range" aria-hidden="true">' +
            '<div class="udr-presets">' +
              '<div class="udr-presets-head">Date range</div>' +
              PRESETS.map(function (p) {
                return '<button type="button" class="udr-preset" data-preset="' + p.key + '">' + p.label + '</button>';
              }).join("") +
              '<button type="button" class="udr-reset">Reset</button>' +
            '</div>' +
            '<div class="udr-divider" aria-hidden="true"></div>' +
            '<div class="udr-cal"></div>' +
          '</div>' +
        '</div>';

      var wrap    = root.querySelector(".udr-wrap");
      var trigger = root.querySelector(".udr-trigger");
      var labelEl = root.querySelector(".udr-label");
      var menu    = root.querySelector(".udr-menu");
      var calEl   = root.querySelector(".udr-cal");
      var resetBtn = root.querySelector(".udr-reset");

      /* A Bubble group around the filter row is routinely shorter than the open panel. Same
         unconditional call topics-manager and brands-overview make. */
      if (UC.unclipAncestors) UC.unclipAncestors(root, false);

      var pop = UC.makePopover({
        wrap: wrap, menu: menu, opener: trigger,
        onClose: function () {
          /* A half-made selection dies with the panel -- committing one click as a range would
             invent an end date the user never picked. */
          pendingStart = null; hoverDate = null;
          trigger.setAttribute("aria-expanded", "false");
          menu.setAttribute("aria-hidden", "true");
          viewMonth = monthOf(committed.to, -1);
          render();
        }
      });

      function isProcessing() { return UC.isYes(root.getAttribute("data-isprocessing")); }
      function monthOf(d, offset) {
        var m = new Date(d.getFullYear(), d.getMonth() + (offset || 0), 1);
        var floor = new Date(MIN_DATE.getFullYear(), MIN_DATE.getMonth(), 1);
        return m < floor ? floor : m;
      }
      function presetRange(key) {
        var from;
        if (key === "last30") from = addDays(TODAY, -29);
        else if (key === "last3") from = addMonths(TODAY, -3);
        else if (key === "last6") from = addMonths(TODAY, -6);
        else from = addDays(TODAY, -6);
        return { from: maxD(MIN_DATE, from), to: TODAY };
      }
      /* While a first click is pending, the allowed window is ±MAX_SPAN_MONTHS around it, so the
         second click cannot produce an over-long range. Otherwise the global bounds apply. */
      function bounds() {
        if (!pendingStart) return { lo: MIN_DATE, hi: TODAY };
        return {
          lo: maxD(MIN_DATE, addMonths(pendingStart, -MAX_SPAN_MONTHS)),
          hi: minD(TODAY, addMonths(pendingStart, MAX_SPAN_MONTHS))
        };
      }

      /* ---------- rendering ---------- */
      function monthsShown() {
        var vw = document.documentElement.clientWidth || window.innerWidth || 0;
        return vw >= 777 ? 2 : 1;
      }
      function layoutClass() {
        var vw = document.documentElement.clientWidth || window.innerWidth || 0;
        return vw >= 777 ? "two" : vw >= 473 ? "one" : "stacked";
      }
      function gridCells(monthStart) {
        /* Monday-first, always 6 rows -- see the fixed grid-auto-rows note in the CSS. */
        var firstDow = (monthStart.getDay() + 6) % 7;
        var out = [], d = addDays(monthStart, -firstDow);
        for (var i = 0; i < 42; i++) { out.push(d); d = addDays(d, 1); }
        return out;
      }
      function previewRange() {
        if (pendingStart) {
          var other = hoverDate || pendingStart;
          return { from: minD(pendingStart, other), to: maxD(pendingStart, other) };
        }
        return committed;
      }
      function render() {
        var mode = layoutClass();
        menu.classList.toggle("is-one-month", mode !== "two");
        menu.classList.toggle("is-stacked", mode === "stacked");

        if (!viewMonth) viewMonth = monthOf(committed.to, -1);
        var count = monthsShown();
        /* In one-month mode the right-hand month is the one that matters (it holds the range end),
           so show that rather than the left of the pair. */
        var first = count === 1 ? monthOf(committed.to, 0) : viewMonth;
        var range = previewRange();
        var b = bounds();
        var floor = new Date(MIN_DATE.getFullYear(), MIN_DATE.getMonth(), 1);
        var ceil = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);

        var html = "";
        for (var m = 0; m < 2; m++) {
          var ms = new Date(first.getFullYear(), first.getMonth() + m, 1);
          var canPrev = m === 0 && new Date(ms.getFullYear(), ms.getMonth() - 1, 1) >= floor;
          var lastShown = new Date(ms.getFullYear(), ms.getMonth() + (count === 2 && m === 0 ? 1 : 0), 1);
          var canNext = new Date(lastShown.getFullYear(), lastShown.getMonth() + 1, 1) <= ceil;
          html += '<div class="udr-month">' +
            '<div class="udr-month-head">' +
              '<button type="button" class="udr-nav udr-prev" aria-label="Previous month"' +
                (canPrev ? "" : " disabled") + ">" + navIcon("left") + "</button>" +
              '<span class="udr-month-title">' + MONTHS_LONG[ms.getMonth()] + " " + ms.getFullYear() + "</span>" +
              '<button type="button" class="udr-nav udr-next" aria-label="Next month"' +
                (canNext ? "" : " disabled") + ">" + navIcon("right") + "</button>" +
            "</div>" +
            '<div class="udr-dows">' + DOWS.map(function (d) { return '<span class="udr-dow">' + d + "</span>"; }).join("") + "</div>" +
            '<div class="udr-grid">' + gridCells(ms).map(function (d) {
              var out = d.getMonth() !== ms.getMonth();
              /* Leading/trailing days are blank placeholders, not dates. In a two-month view the
                 same day otherwise appears in both grids -- July's trailing cells ARE early
                 August -- so a range spanning the boundary got painted twice and read as two
                 separate ranges. They only keep their grid cell so the weeks stay aligned. */
              if (out) return '<span class="udr-day is-out" aria-hidden="true"></span>';
              var disabled = d < b.lo || d > b.hi;
              var cls = "udr-day";
              if (out) cls += " is-out";
              if (sameDay(d, TODAY)) cls += " is-today";
              if (!disabled && range) {
                if (sameDay(d, range.from)) cls += " is-start";
                if (sameDay(d, range.to)) cls += " is-end";
                if (d > range.from && d < range.to) cls += " is-in";
              }
              return '<button type="button" class="' + cls + '" data-d="' + iso(d) + '"' +
                     (disabled ? " disabled" : "") + ' tabindex="' + (out ? -1 : 0) + '">' +
                     d.getDate() + "</button>";
            }).join("") + "</div>" +
          "</div>";
        }
        calEl.innerHTML = html;
        Array.prototype.forEach.call(root.querySelectorAll(".udr-preset"), function (b2) {
          b2.classList.toggle("is-active", b2.getAttribute("data-preset") === committedPreset);
        });
      }

      /* ---------- commit ---------- */
      function persist() {
        STATE[instanceId] = {
          from: iso(committed.from), to: iso(committed.to),
          preset: committedPreset, label: committedLabel
        };
      }
      function paint() {
        labelEl.textContent = committedLabel;
        trigger.setAttribute("title", rangeLabel(committed.from, committed.to));
        root.setAttribute("data-date-from", iso(committed.from));
        root.setAttribute("data-date-to", iso(committed.to));
      }
      function commit(from, to, preset, text, shouldEmit) {
        committed = { from: from, to: to };
        committedPreset = preset;
        committedLabel = text;
        pendingStart = null; hoverDate = null;
        viewMonth = monthOf(to, -1);
        persist(); paint(); render();
        if (shouldEmit) emit(from, to);
      }
      function applyPreset(key, shouldEmit) {
        var p = null;
        for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].key === key) p = PRESETS[i];
        if (!p) return false;
        commit(presetRange(key).from, presetRange(key).to, key, p.label, shouldEmit);
        return true;
      }

      /* ---------- Bubble bridge ----------
         The two date functions get a real Date object, the range function gets JSON. That split is
         the standalone's contract and the existing workflows depend on it, so this cannot go
         through UC.makeFire (which JSON-stringifies everything). */
      function callFn(attr, fallback, value) {
        var name = root.getAttribute(attr) || fallback;
        var fn = UC.resolveBubbleFn(name);
        if (typeof fn === "function") { try { fn(value); } catch (e) {} return true; }
        return false;
      }
      function emit(from, to) {
        if (isProcessing()) return;
        emitSeq += 1;
        var payload = {
          instance_id: instanceId,
          date_from: iso(from),
          date_to: iso(to),
          event_id: instanceId + "_" + Date.now() + "_" + emitSeq
        };
        var json = JSON.stringify(payload);
        root.setAttribute("data-range-json", json);
        try { root.dispatchEvent(new CustomEvent("change", { detail: payload, bubbles: true })); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent("upstreem:date-range", { detail: payload })); } catch (e) {}
        callFn("data-date-from-fn", "bubble_fn_udr_date_from", new Date(from.getFullYear(), from.getMonth(), from.getDate()));
        callFn("data-date-to-fn",   "bubble_fn_udr_date_to",   new Date(to.getFullYear(), to.getMonth(), to.getDate()));
        if (!callFn("data-range-fn", "bubble_fn_udr_date_range", json) && window.console) {
          console.warn("[date-range] " + (root.getAttribute("data-range-fn") || "bubble_fn_udr_date_range") +
            " not found on window/parent/top — this change reached no Bubble workflow.");
        }
      }

      /* ---------- interaction ---------- */
      trigger.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (isProcessing()) return;
        if (pop.isOpen()) { pop.close(false); return; }
        render();
        pop.open();
        trigger.setAttribute("aria-expanded", "true");
        menu.setAttribute("aria-hidden", "false");
        /* Left-aligned unless that would run off screen. Decided once per open; the panel is
           absolute, so it stays glued to the trigger from here on without any scroll handler. */
        menu.classList.remove("is-right");
        var tr = trigger.getBoundingClientRect();
        var vw = document.documentElement.clientWidth || window.innerWidth;
        if (tr.left + menu.offsetWidth > vw - 8) menu.classList.add("is-right");
      });

      menu.addEventListener("click", function (e) {
        var preset = e.target.closest(".udr-preset");
        if (preset) {
          e.stopPropagation();
          if (isProcessing()) return;
          applyPreset(preset.getAttribute("data-preset"), true);
          pop.close(true);
          return;
        }
        if (e.target.closest(".udr-reset")) {
          e.stopPropagation();
          if (isProcessing()) return;
          applyPreset(DEFAULT_PRESET, true);
          pop.close(true);
          return;
        }
        var nav = e.target.closest(".udr-nav");
        if (nav) {
          e.stopPropagation();
          if (nav.disabled) return;
          var step = nav.classList.contains("udr-prev") ? -1 : 1;
          viewMonth = monthOf(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + step, 1), 0);
          render();
          return;
        }
        var day = e.target.closest(".udr-day");
        if (day && !day.disabled) {
          e.stopPropagation();
          if (isProcessing()) return;
          var d = parseIso(day.getAttribute("data-d"));
          if (!d) return;
          if (!pendingStart) {
            /* First click: arm the range and let the bounds tighten around it. Nothing is
               published yet -- a one-sided range is not a filter. */
            pendingStart = d; hoverDate = d;
            committedPreset = null;
            render();
          } else {
            var from = minD(pendingStart, d), to = maxD(pendingStart, d);
            commit(from, to, null, rangeLabel(from, to), true);
            pop.close(true);
          }
        }
      });

      /* Live preview of the range under the cursor while the second click is pending. Delegated,
         so it survives every re-render. */
      menu.addEventListener("mouseover", function (e) {
        if (!pendingStart) return;
        var day = e.target.closest(".udr-day");
        if (!day || day.disabled) return;
        var d = parseIso(day.getAttribute("data-d"));
        if (!d || sameDay(d, hoverDate)) return;
        hoverDate = d;
        render();
      });

      /* Arrow keys move day to day across month boundaries -- the reason the cells are real
         buttons rather than the divs the third-party widget rendered. */
      menu.addEventListener("keydown", function (e) {
        var day = e.target.closest && e.target.closest(".udr-day");
        if (!day) return;
        var delta = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 :
                    e.key === "ArrowUp" ? -7 : e.key === "ArrowDown" ? 7 : 0;
        if (!delta) return;
        e.preventDefault();
        var d = parseIso(day.getAttribute("data-d"));
        if (!d) return;
        var target = addDays(d, delta);
        var b = bounds();
        if (target < b.lo || target > b.hi) return;
        var next = root.querySelector('.udr-day[data-d="' + iso(target) + '"]:not([disabled])');
        if (!next) {
          viewMonth = monthOf(target, monthsShown() === 2 ? -1 : 0);
          render();
          next = root.querySelector('.udr-day[data-d="' + iso(target) + '"]:not([disabled])');
        }
        if (next) next.focus();
      });

      /* Layout depends on the VIEWPORT, so it has to be re-evaluated on resize. Only re-renders
         when the bucket actually changes -- UC.onResize already coalesces to one call per frame. */
      var lastMode = layoutClass();
      if (UC.onResize) {
        UC.onResize(root, function () {
          var m = layoutClass();
          if (m === lastMode) return;
          lastMode = m;
          render();
        });
      }

      /* Theme + processing flag mirror, same as every other component: Bubble writes data-isdark,
         core's CSS keys off data-theme. */
      function syncConfig() {
        /* Two drivers, and the order matters. Reading the CURRENT data-theme as a second source of
           "is it dark" makes the state one-way: once dark, data-isdark="no" could never take it
           back, because data-theme itself kept voting dark. So data-isdark wins whenever Bubble
           has set it at all, and a data-theme written by setDateRangeTheme() only survives while
           there is no data-isdark to override it. Same rule prompt-research.js uses. */
        if (UC.isYes(root.getAttribute("data-isdark"))) root.setAttribute("data-theme", "dark");
        else if (root.getAttribute("data-theme") !== "dark" || root.hasAttribute("data-isdark")) root.removeAttribute("data-theme");
        root.classList.toggle("is-processing", isProcessing());
        if (isProcessing() && pop.isOpen()) pop.close(false);
      }
      new MutationObserver(syncConfig).observe(root, {
        attributes: true, attributeFilter: ["data-isdark", "data-isprocessing"]
      });

      var ctrl = {
        root: root,
        instanceId: instanceId,
        /* External reset is SILENT by design: it realigns the picker with a date change that has
           already happened elsewhere. Emitting here would kick off a second page-wide refresh the
           user never asked for. The Reset button inside the panel does publish. */
        reset: function () { return applyPreset(DEFAULT_PRESET, false); },
        setPreset: function (key, emitToo) { return applyPreset(key, emitToo === true); },
        setTheme: function (t) {
          var dark = String(t || "").toLowerCase() === "dark";
          if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
        },
        getRange: function () { return { from: iso(committed.from), to: iso(committed.to), preset: committedPreset }; }
      };
      root.__udrCtrl = ctrl;
      CONTROLLERS.push(ctrl);

      syncConfig(); paint(); render();
      return ctrl;
    }

    function forEachInstance(instanceId, fn) {
      var id = String(instanceId || "").trim();
      var hit = false;
      CONTROLLERS = CONTROLLERS.filter(function (c) { return c.root && c.root.isConnected; });
      CONTROLLERS.forEach(function (c) {
        if (!id || c.instanceId === id) { fn(c); hit = true; }
      });
      return hit;
    }
    function initAll() {
      Array.prototype.forEach.call(document.querySelectorAll(".udr-root, [data-udr-root]"), initRoot);
    }

    /* Same names the standalone exposed, so existing "Run JavaScript" steps keep working
       unchanged -- resetUpstreemDateRangePicker('dates_v2_') included. */
    window.resetUpstreemDateRangePicker = function (instanceId) {
      initAll();
      return forEachInstance(instanceId, function (c) { c.reset(); });
    };
    window.setDateRangePreset = function (instanceId, key, emitToo) {
      initAll();
      return forEachInstance(instanceId, function (c) { c.setPreset(key, emitToo); });
    };
    window.setDateRangeTheme = function (instanceId, theme) {
      initAll();
      return forEachInstance(instanceId, function (c) { c.setTheme(theme); });
    };

    initAll();
    if (UC.watchRoots) UC.watchRoots("udr-root", initAll);

    var q = window.__udrBootQueue;
    if (q && q.length) {
      q.splice(0, q.length).forEach(function (entry) {
        try { window[entry[0]].apply(null, entry[1]); }
        catch (e) { if (window.console) console.error("[date-range] queued " + entry[0] + " failed:", e); }
      });
    }
  }

  udrBoot(50);
})();
