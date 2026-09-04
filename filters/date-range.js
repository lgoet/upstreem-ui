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
  /* upstreemDatesActivate steht mit in der Liste: ein "Run javascript"
     in Bubble laeuft oft, bevor date-range.js vom CDN da ist. Der Aufruf war dann ein
     TypeError, den Bubble schluckt -- kein Eintrag in der Konsole, keine States, und die RPCs
     liefen mit null. Genau die Haelfte der Faelle von "manchmal geht es nicht".
     getUpstreemDateRange ist NICHT dabei: es gibt einen Wert zurueck, und ein Stub, der
     stattdessen true liefert, waere schlimmer als der Fehler. */
  var API_NAMES = ["resetUpstreemDateRangePicker", "setDateRangePreset", "setDateRangeTheme",
                   "upstreemDatesActivate"];
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
    /* Uebersetzung und Maskierung aus core. Der Schluessel IST der englische Text -- ein Label
       ohne Katalogeintrag kommt unveraendert zurueck und bleibt richtiges Englisch. */
    var t = UC.t || function (x) { return x; };
    var esc = UC.esc || function (x) { return String(x == null ? "" : x); };

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

    /* ---- DER GLOBALE KALENDER --------------------------------------------------------------
       "Apply everywhere": ein Zeitraum fuer alle Ansichten. Der Schalter sitzt unter Reset, ist
       standardmaessig AUS und liegt in core's Einstellungsspeicher (up_prefs), damit er einen
       Reload uebersteht und alle Picker ueber up-prefs-change davon erfahren.

       WER TEILNIMMT: eine Regel, keine Liste -- sonst muss sie bei jeder neuen Ansicht gepflegt
       werden und wird es nicht. Ausgenommen sind der Export-Kalender (ein Export ist eine eigene
       Handlung mit eigenem Zeitraum) und die Spotlight-Kalender in den Drawern (ein Spotlight ist
       die Detailansicht EINER Sache; dort einen anderen Zeitraum zu haben ist nicht falsch).
       Wer nicht teilnimmt, bekommt den Schalter gar nicht zu sehen -- ein ausgegrauter Schalter
       ohne Wirkung ist schlechter als keiner.

       WAS SPEICHERBAR IST: nur die drei RELATIVEN Presets. Ein absoluter Zeitraum waere morgen
       falsch, und "Letzte 6 Monate" ist ausdruecklich nicht dabei. Bei aktivem Schalter sind
       beide deshalb ausgegraut, mit einem Hinweis -- ausgeblendet wirkten sie wie ein Fehler. */
    function nimmtTeil(id){ return !/export|spotlight/i.test(String(id || "")); }
    var TEILBAR = { last7: 1, last30: 1, last3: 1 };
    function syncAn(){ return UC.getPref && UC.getPref("date_sync") === "on"; }

    /* ---- DER ZEITRAUM IN DER URL ------------------------------------------------------------
       Das Log der echten Seite hat gezeigt, dass diese Datei beim Aufbau genau EINEN Bubble-Aufruf
       macht, mit genau einem Abnehmer -- und die RPCs trotzdem zweimal laufen. Der zweite kommt
       nicht von einem zweiten Aufruf, sondern von der ZUSTANDSAENDERUNG: Bubble bewertet eine
       Abfrage neu, wenn ein State, den sie liest, sich aendert. Und Bubbles
       JavaScriptToBubble-Bruecke stand im Log erst bei 3503ms, also lange nach dem
       Page-Load-Workflow. Erster Durchlauf mit dem Vorgabe-Zeitraum, zweiter nach unserer
       Uebergabe. Das kann kein JavaScript gewinnen: wer erst nach 3,5 Sekunden reden darf, kommt
       nach der ersten Abfrage.

       Also muss der Zeitraum an einem Ort stehen, den Bubble OHNE JavaScript liest -- in der URL.
       Ein Parameter, der PRESET heisst und nicht Datum: ein absolutes Datum in der URL ist morgen
       falsch, ein Lesezeichen von letzter Woche waere eine Zeitreise. "last30" bleibt richtig, und
       Bubble rechnet daraus zwei Datumsangaben (current date/time minus 29 days).

       Geschrieben wird ohne Reload (replaceState), damit ein Preset-Klick nicht die Seite kostet.
       Und beim Aufbau wird die URL nachgezogen, wenn sie nicht zum gespeicherten Stand passt:
       damit heilt sich der Zustand nach EINEM Seitenaufbau selbst, auch wenn niemand den Schalter
       anfasst. */
    /* ---- Der Zeitraum in der URL: NUR auf ausdrueckliche Ansage --------------------------
       data-url-range="on" an der Wurzel schaltet es ein. Ohne das Attribut wird die URL nicht
       angefasst -- weder gelesen noch geschrieben.

       Ich hatte das ungefragt zum Standardverhalten gemacht. Das war zweimal falsch: es ist eine
       Aenderung an der URL der App, um die niemand gebeten hat, und es hat den Zustand
       verschlechtert, weil das Ueberspringen der Uebergabe einen Bubble-Schritt voraussetzt, den
       es nicht gibt.

       Wer den Schritt hat -- Page-Load-Workflow liest range und setzt die zwei Datums-States,
       bevor die erste Abfrage laeuft --, schaltet es ein und bekommt dafuer: einen Ladevorgang
       beim Aufbau statt zwei, weil Bubble den Zeitraum dann schon vor der ersten Abfrage kennt
       und unsere Uebergabe entfaellt. */
    function urlAn(root){
      return String(root && root.getAttribute("data-url-range") || "").toLowerCase() === "on";
    }
    var URL_PARAM = "range";
    function urlPreset(){
      if (!urlNutzbar()) return null;
      try {
        var m = new RegExp("[?&]" + URL_PARAM + "=([^&#]*)").exec(window.location.search);
        var v = m ? decodeURIComponent(m[1]) : "";
        return TEILBAR[v] ? v : null;
      } catch (e) { return null; }
    }
    /* Gibt die neue URL zurueck, ohne sie zu setzen -- der Aufrufer entscheidet zwischen
       replaceState (still) und reload (der Schalter). Vorhandene Parameter bleiben, insbesondere
       ?view= und ?detail=, an denen das View-System der Seite haengt. */
    /* Nur auf einer echten Seite. In einem about:blank-Rahmen loest window.location.href die URL
       des ERZEUGERS auf -- ein location.replace darauf laedt dann die Elternseite in den Rahmen.
       Genau so im eigenen Prueftand passiert: der Rahmen lud den Prueftand rekursiv und dessen
       erster Schritt loeschte die Einstellungen, die der Klick gerade geschrieben hatte. Auf der
       echten Bubble-Seite faellt das nicht auf, falsch ist es trotzdem. */
    function urlNutzbar(){
      try {
        var pr = window.location.protocol;
        if (pr !== "http:" && pr !== "https:") return false;
        if (!window.history || typeof window.history.replaceState !== "function") return false;
        /* Nur im OBERSTEN Fenster. Bubble laedt die Seite dort, und dort steht die URL, die beim
           naechsten Aufbau gelesen wird -- die URL eines eingebetteten Rahmens interessiert
           niemanden. Und ein about:blank-Rahmen meldet in Chrome die URL seines Erzeugers, also
           haette ein Protokoll-Test allein nicht gereicht: der eigene Prueftand hat sich damit
           rekursiv selbst in den Rahmen geladen. */
        return window === window.top;
      } catch (e) { return false; }
    }
    function urlMit(preset){
      if (!urlNutzbar()) return null;
      try {
        var u = new URL(window.location.href);
        if (preset) u.searchParams.set(URL_PARAM, preset);
        else u.searchParams.delete(URL_PARAM);
        return u.href;
      } catch (e) { return null; }
    }
    function urlSchreiben(preset){
      if (!urlNutzbar()) return false;
      var href = urlMit(preset);
      if (!href || href === window.location.href) return false;
      try { window.history.replaceState(window.history.state, "", href); }
      catch (e) { return false; }
      return true;
    }
    function syncPreset(){
      var p = UC.getPref ? UC.getPref("date_preset") : null;
      return TEILBAR[p] ? p : DEFAULT_PRESET;
    }

    var ICON_CAL  = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>';
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
    /* Aufrufe, die vor ihrem Kalender eintrafen. Die Warteschlange steht jetzt in core
       (UC.makeLate) -- sie lag hier und in den drei Filtern viermal fast gleich, jeweils mit nur
       EINEM Platz je id und ohne Verfall. */
    var spaet = UC.makeLate ? UC.makeLate("date-range", ".udr-root, [data-udr-root]") : null;

    function initRoot(root) {
      /* Keyed on the controller itself, NOT on a flag set up front. The flag used to be raised
         here, on the first line -- but the controller is only built and registered ~370 lines
         below, so anything throwing in between left the element permanently marked "initialised"
         with no controller behind it. Every later initAll() then skipped it, CONTROLLERS stayed
         empty, and resetUpstreemDateRangePicker() reported no picker for an element that is
         plainly sitting there with the right id. Exactly the "(none yet)" case.
         With the check on __udrCtrl a failed attempt leaves nothing behind, so the next initAll()
         -- and every API call starts with one -- simply tries again. */
      if (!root) return null;
      /* Already built -- but make sure it is still IN the registry before handing it back.
         forEachInstance prunes controllers whose root is not currently isConnected, and Bubble
         detaches and re-attaches these elements constantly while a page settles. The controller
         then left CONTROLLERS while root.__udrCtrl stayed on the element, so this early return
         handed back a controller the API could no longer see and initRoot refused to rebuild it:
         permanently invisible to resetUpstreemDateRangePicker even though the element is right
         there, mounted and working. Measured on a real page: 21 roots in the DOM, "Mounted: none".
         Re-adopting is enough -- the controller itself is still perfectly valid, it was only
         dropped from the list. */
      if (root.__udrCtrl) {
        if (CONTROLLERS.indexOf(root.__udrCtrl) < 0) CONTROLLERS.push(root.__udrCtrl);
        return root.__udrCtrl;
      }

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
              /* data-i18n TRAEGT DEN ENGLISCHEN SCHLUESSEL, obwohl hier schon uebersetzt wird.
                 Ohne das gibt es zwei Quellen fuer denselben Text und sie widersprechen sich: der
                 Sprachlauf in core merkt sich sonst den DEUTSCHEN Text als Original, und der Weg
                 zurueck auf Englisch ist verloren. Gemessen: nach de -> en stand weiter
                 "Letzte 7 Tage". Uebersetzt wird hier trotzdem, damit beim ersten Zeichnen nicht
                 kurz Englisch aufblitzt. */
              '<div class="udr-presets-head" data-i18n="Date range">' + esc(t("Date range")) + '</div>' +
              PRESETS.map(function (p) {
                return '<button type="button" class="udr-preset" data-preset="' + p.key + '"' +
                       ' data-i18n="' + esc(p.label) + '">' + esc(t(p.label)) + '</button>';
              }).join("") +
              '<button type="button" class="udr-reset" data-i18n="Reset">' + esc(t("Reset")) + '</button>' +
              (nimmtTeil(instanceId)
                ? '<button type="button" class="udr-sync" role="switch" aria-checked="' +
                    (syncAn() ? "true" : "false") + '" data-tip="' +
                    esc(t("Reloads the page")) + '">' +
                    '<span class="udr-sync-lbl" data-i18n="Apply everywhere">' +
                      esc(t("Apply everywhere")) + '</span>' +
                    /* Der Schalter ist hier nur noch das BILD des Zustands -- role und
                       aria-checked sitzen an der Zeile, weil die Zeile das Bedienelement ist.
                       Zwei Elemente mit role="switch" uebereinander waeren fuer einen Screenreader
                       zwei Schalter fuer dieselbe Sache. */
                    '<span class="up-switch' + (syncAn() ? " is-on" : "") + '" aria-hidden="true" ' +
                      'data-udr-sync></span>' +
                  '</button>'
                : "") +
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

      /* ---------- open/close ----------
         Hand-rolled setOpen() statt UC.makePopover, und zwar aus EINEM Grund: es macht diesen
         Kalender strukturell identisch zu den drei Filter-Dropdowns (topics/models/markets), die
         alle direkt UC.dropdownOpened rufen.

         Der Unterschied war nicht kosmetisch. `UC` ist die Referenz, die diese Datei beim Boot
         auf window.UpstreemCore vorgefunden hat. Traegt auch nur EIN Element auf der Seite einen
         anderen data-cdn-pin, laedt dessen Loader eine zweite core.js unter einer zweiten URL --
         die Dedupe-Registry greift nur pro URL -- und dann haengt jede Komponente an der Kopie,
         die zu IHREM Boot-Zeitpunkt gerade da war. makePopover schliesst dabei ueber eine
         Closure in seiner eigenen Kopie ab: der Kalender lief damit weiter auf altem Code,
         waehrend die drei Filter laengst den neuen benutzten. Genau das Bild "drei Dropdowns
         gehen, der Kalender nicht".

         dropdownOpened wird darum bei jedem Oeffnen frisch von window.UpstreemCore geholt. Die
         Registries selbst (OPEN_DD, POPOVERS) liegen ohnehin auf window und werden von allen
         Kopien geteilt -- es zaehlt also nur, dass die AUFRUFENDE Funktion aktuell ist. */
      var isPanelOpen = false, unregister = null;
      function setOpen(v) {
        v = !!v;
        if (isPanelOpen === v) return;
        isPanelOpen = v;
        wrap.classList.toggle("is-open", v);
        menu.classList.toggle("is-shown", v);
        menu.setAttribute("aria-hidden", v ? "false" : "true");
        trigger.setAttribute("aria-expanded", v ? "true" : "false");
        if (v) {
          var U = window.UpstreemCore || UC;
          unregister = U.dropdownOpened
            ? U.dropdownOpened(menu, function () { setOpen(false); }, trigger)
            : null;
          return;
        }
        if (unregister) { unregister(); unregister = null; }
        /* Fokus raus, BEVOR aria-hidden greift -- der Kalender laesst Tage per Pfeiltasten
           fokussieren, und ein fokussiertes Element in einem aria-hidden-Teilbaum schluckt
           Tastatureingaben. makePopover hat das erledigt, hier steht es jetzt selbst. */
        try { if (menu.contains(document.activeElement)) trigger.focus(); } catch (e) {}
        /* A half-made selection dies with the panel -- committing one click as a range would
           invent an end date the user never picked. */
        pendingStart = null; hoverDate = null;
        viewMonth = monthOf(committed.to, -1);
        render();
      }
      var pop = { open: function () { setOpen(true); },
                  close: function () { setOpen(false); },
                  isOpen: function () { return isPanelOpen; } };

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

        /* Bei aktivem Schalter ist die Auswahl im Kalender gesperrt (ein eigener Zeitraum ist
           nicht teilbar). Jeder Tag traegt dann den Hinweis, was zu tun ist. */
        var gesperrt = syncAn() && nimmtTeil(instanceId);
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
                     (disabled ? " disabled" : "") + ' tabindex="' + (out ? -1 : 0) + '"' +
                     /* Der Hinweis gleich mit ins Markup: das Raster wird bei jedem Monatswechsel
                        neu gebaut, ein Nachtrag von aussen kaeme jedes Mal zu spaet. */
                     (gesperrt ? ' data-tip="' + esc(t("Turn off Apply everywhere")) + '"' : "") + '>' +
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
        /* Uebersetzt beim SCHREIBEN und nicht beim Speichern: committedLabel geht als Text mit
           dem Ereignis nach Bubble, und dort muss derselbe Wert ankommen wie bisher.
           data-i18n haelt den englischen Schluessel -- siehe oben, gleiche Begruendung. */
        labelEl.setAttribute("data-i18n", committedLabel);
        labelEl.textContent = t(committedLabel);
        trigger.setAttribute("title", rangeLabel(committed.from, committed.to));
        root.setAttribute("data-date-from", iso(committed.from));
        root.setAttribute("data-date-to", iso(committed.to));
      }
      /* data-range-current ist RAUS. Es trug den Zeitraum, den der Kalender gerade zeigt, damit
         ein Bubble-Workflow ihn abholen kann, ohne auf uns zu warten. Der Versuch ist gemessen
         gescheitert: das Snippet, das es aus dem DOM las, lieferte null und ueberschrieb damit die
         richtigen Datumsangaben. Danach war der Weg upstreemDatesActivate(view), und das Attribut
         hat nie wieder jemand gelesen -- ein Schreibzugriff bei jeder Aenderung, ohne Abnehmer. */
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
        if (typeof fn !== "function") return false;
        try { fn(value); } catch (e) {}
        return true;
      }
      /* grund sagt, WARUM dieser Zeitraum kommt -- und das entscheidet, ob die Seite nachlaedt:

           "user"      jemand hat im Kalender geklickt (auch Reset). Nur hier laeuft der zweite
                       Kanal (data-range-apply-fn), also der seitenweite Workflow.
           "boot"      Seitenaufbau: die States sollen stimmen, BEVOR die Seite von sich aus laedt.
                       Ein Nachladen waere hier ein zweiter Ladevorgang direkt neben dem ersten.
           "activate"  Ansichtswechsel: die Ansicht laedt ueber ihren eigenen Workflow.
           "sync"      ein anderer Picker hat den geteilten Zeitraum geaendert; diese Ansicht wird
                       nur nachgezogen und laedt beim naechsten Aktivieren.

         Der Grund steht IM JSON, damit ein Workflow ihn lesen kann -- ohne ihn kann Bubble einen
         Aufbau nicht von einem Klick unterscheiden, und genau daran hing der doppelte Aufruf. */
      /* Rueckgabe: hat MINDESTENS EIN Bubble-Kanal getroffen? Ohne diese Auskunft war eine
         Uebergabe ins Leere von einer erfolgreichen nicht zu unterscheiden -- und genau daran
         hing der Fehler vom 03.09.: der Aufbau feuerte, bevor Bubbles
         JavaScriptToBubble-Elemente existierten, vermerkte sich trotzdem als erledigt und
         blockierte damit auch noch den Ansichtswechsel. */
      function emit(from, to, grund) {
        if (isProcessing()) return false;
        grund = grund || "user";
        emitSeq += 1;
        var payload = {
          instance_id: instanceId,
          date_from: iso(from),
          date_to: iso(to),
          preset: committedPreset || "",
          reason: grund,
          event_id: instanceId + "_" + Date.now() + "_" + emitSeq
        };
        var json = JSON.stringify(payload);
        /* data-range-json ist der letzte Zeitraum, den EIN MENSCH ausgewaehlt hat -- und nur der.
           Der Nutzer hat am 03.09. gezeigt, was auf seiner Seite am Ende des
           date_range-Workflows laeuft:

             var el = document.querySelector('.udr-root[data-instance="dates_v2_dashboard"]');
             if (el) window.bubble_fn_udr_apply_dashboard(el.getAttribute("data-range-json"));

           Das Attribut ist dort der Bote: es traegt die Auswahl aus dem Reusable auf die Seite,
           die daraufhin nachlaedt. Es beim AUFBAU zu schreiben machte den Aufbau von einer
           Nutzerauswahl ununterscheidbar -- steht dieses Snippet auch im boot-Workflow, ruft der
           Seitenaufbau darueber apply, und das ist die zweite RPC-Runde.
           Also nur bei "user". Ein Aufbau und ein Ansichtswechsel hinterlassen nichts, was wie
           eine Auswahl aussieht.

           data-range-reason steht IMMER da, damit ein Workflow, der das Snippet an einer
           ungewollten Stelle hat, sich selbst absichern kann:
             if (el && el.getAttribute("data-range-reason") === "user") ... */
        root.setAttribute("data-range-reason", grund);
        /* data-range-apply sagt in einem Wort, was ein Snippet auf der Seite wissen muss:
           weiterreichen oder nicht. Der Grund allein reicht dafuer nicht -- "user" und "stale"
           sollen beide nachladen, "boot" und "activate" nicht, und diese Liste im Snippet zu
           pflegen waere die Art Wissen, die auseinanderlaeuft. */
        root.setAttribute("data-range-apply", grund === "user" ? "yes" : "no");
        if (grund === "user") root.setAttribute("data-range-json", json);
        try { root.dispatchEvent(new CustomEvent("change", { detail: payload, bubbles: true })); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent("upstreem:date-range", { detail: payload })); } catch (e) {}
        /* Beim AUFBAU wird genau EIN Kanal gerufen, der Aufbau-Kanal, und sonst keiner.
           Im Log der echten Seite standen bei +4156ms drei Treffer nebeneinander:
           date_from_dashboard OK, date_to_dashboard OK, boot_dashboard OK. Also drei
           Bubble-Workflows fuer eine Uebergabe -- und einer davon laedt nach. Genau das war der
           doppelte RPC-Durchlauf, den der Nutzer von Anfang an vorhergesagt hat.
           Die zwei Datums-Funktionen sind dabei ueberfluessig: date_from und date_to stehen als
           ISO-Text IM JSON des Aufbau-Kanals, sein Workflow setzt beide States daraus. Ein Kanal
           ist das Minimum, und weniger als einmal kann nichts doppelt laufen. */
        /* NUR-STATES: der Seitenaufbau und der Ansichtswechsel. Beide sollen die Datums-States
           setzen und NICHTS ausloesen -- sie gehen deshalb ueber denselben Kanal (data-boot-fn)
           und rufen weder from/to noch den Nachlade-Kanal.
           Der Ansichtswechsel war zwischenzeitlich ganz still, weil ich annahm, die States seien
           seitenweit und stuenden schon. Gemessen: sie sind es NICHT -- die Citations-Ansicht lud
           mit p_date_from: null. Jede Ansicht hat eigene States, jede braucht ihre Uebergabe.
           Ueber den Range-Kanal darf sie nicht gehen: dort haengt der Nachlade-Workflow, und der
           war der zweite Durchlauf beim Wechsel. */
        var nurStates = grund === "boot" || grund === "activate";
        if (!nurStates) {
          callFn("data-date-from-fn", "bubble_fn_udr_date_from", new Date(from.getFullYear(), from.getMonth(), from.getDate()));
          callFn("data-date-to-fn",   "bubble_fn_udr_date_to",   new Date(to.getFullYear(), to.getMonth(), to.getDate()));
        }
        /* ---- DER AUFBAU HAT EINEN EIGENEN KANAL -------------------------------------------
           Zwei Anlaeufe daneben, und beide Male aus derselben falschen Annahme.

           Erst legte ich den Grund "boot" ins JSON und erwartete, dass die Seite darauf
           verzweigt. Falsche Richtung: an data-range-fn haengt der Workflow, der NACHLAEDT --
           jedes Ereignis dort ist ein Ladevorgang, egal was im JSON steht. Ergebnis: jeder RPC
           lief zweimal.
           Dann rief der Aufbau nur noch die zwei Datums-Funktionen. Auch falsch, und diesmal war
           es eine Auskunft, die ich schon hatte: auf DIESER Seite setzt der Range-Workflow die
           States, from und to haben dort gar keinen Abnehmer. Ergebnis: keine Doppelung mehr,
           aber auch keine Daten -- die RPCs liefen ohne Zeitraum.

           Der Aufbau braucht also beides: die States setzen UND nicht nachladen. Zwei
           Anforderungen an EINEN Kanal, die sich widersprechen -- solange es nur einen gibt. Also
           hat der Aufbau seinen eigenen:

             data-range-fn  (bubble_fn_udr_date_range)  Auswahl im Kalender -> States + Nachladen
             data-boot-fn   (bubble_fn_udr_date_boot)   Seitenaufbau        -> NUR States

           Dieselbe Trennung, die dieses Bauteil zwischen Reusable und Seite schon hat
           (data-range-apply-fn), nur eine Ebene tiefer. Beide bekommen das identische JSON.

           Fehlt der Aufbau-Kanal, wird der Range-Kanal gerufen und EINMAL gesagt, was zu tun ist:
           eine Seite ohne Zeitraum ist schlimmer als eine, die zweimal laedt, und still wollen
           wir keins von beidem. */
        var istBoot = nurStates;
        if (istBoot) {
          if (callFn("data-boot-fn", "bubble_fn_udr_date_boot", json)) return true;
          /* Der Hinweis auf das fehlende Element NUR, wenn der Range-Kanal wirklich da ist.
             Sonst ist nicht ein Element unvollstaendig, sondern die Bruecke nach Bubble steht
             noch gar nicht -- und die Meldung schickte den Nutzer auf die falsche Spur (genau so
             passiert: sie nannte das boot-Element, waehrend keine einzige bubble_fn existierte). */
          var rangeDa = typeof UC.resolveBubbleFn(
            root.getAttribute("data-range-fn") || "bubble_fn_udr_date_range") === "function";
          if (rangeDa && !window.__udrBootFnGesagt && window.console) {
            window.__udrBootFnGesagt = true;
            console.warn("[date-range] " + (root.getAttribute("data-boot-fn") ||
              "bubble_fn_udr_date_boot") + " gibt es nicht. Der Zeitraum geht deshalb ueber " +
              "bubble_fn_udr_date_range an Bubble -- und weil daran der Nachlade-Workflow haengt, " +
              "laedt die Seite beim Aufbau womoeglich zweimal. Abhilfe: ein JavaScriptToBubble " +
              "mit diesem Namen anlegen und in seinem Workflow NUR die beiden Datums-States aus " +
              "date_from und date_to setzen, ohne Refresh.");
          }
        }
        var rangeGetroffen = callFn("data-range-fn", "bubble_fn_udr_date_range", json);
        if (!rangeGetroffen && !nurStates && window.console) {
          console.warn("[date-range] " + (root.getAttribute("data-range-fn") || "bubble_fn_udr_date_range") +
            " not found on window/parent/top — this change reached no Bubble workflow.");
        }
        /* ZWEITER KANAL, wie ihn die drei anderen Filter seit jeher haben (data-topics-apply-fn
           und Geschwister). Der Unterschied ist nicht technisch, sondern wer zuhoert:

             data-range-fn        das Element IM Reusable. Es besitzt die Auswahl und schreibt sie
                                  in die eigenen States des Reusables.
             data-range-apply-fn  ein Element AUF DER SEITE. Es sagt der Tabelle, dass sie neu
                                  laden soll. Ein Reusable kann keinen seitenweiten Workflow
                                  ausloesen -- genau darum gibt es diesen zweiten Namen, und genau
                                  darum brauchte es hier bisher einen Zaehler-State als Umweg.

           Dieselbe Reihenfolge wie bei topics: erst das Reusable, damit dessen States gesetzt
           sind, wenn die Seite reagiert. Beide bekommen das IDENTISCHE JSON, ein Workflow am
           zweiten Kanal muss also nie in die States des Reusables hineinlesen.

           Optional: ohne Attribut kein Aufruf und keine Warnung -- wer weiter mit dem Zaehler
           arbeitet, merkt von der Erweiterung nichts. Kein Standardname als Rueckfall, denn ein
           erfundener Name wuerde auf einer Seite, die ihn nicht kennt, still ins Leere laufen. */
        var applyName = grund === "user" ? root.getAttribute("data-range-apply-fn") : null;
        if (applyName) {
          /* Aufschub, und zwar mit Absicht. Die drei Aufrufe darueber stossen je einen
             Bubble-Workflow an; die laufen ASYNCHRON in Bubbles eigener Warteschlange, waehrend
             der JS-Aufruf sofort zurueckkehrt. Feuert Apply in derselben Millisekunde mit, laedt
             die Seite nach, BEVOR der Workflow im Reusable seine States geschrieben hat -- man
             sieht dann die neue Granularitaet neben den alten Daten. Genau so gemeldet.

             Die anderen Filter haben dieselbe Konstruktion, dort steht aber nur EIN Workflow
             vorweg statt drei; die Race existiert auch da, sie schlaegt nur seltener zu.

             Das ist eine Heuristik, keine Garantie -- JS kann nicht wissen, wann Bubble seine
             Warteschlange geleert hat. 120ms sind reichlich fuer drei State-Zuweisungen und
             bleiben unter der Schwelle, ab der sich ein Klick traege anfuehlt. Wem das nicht
             genuegt, stellt es per data-range-apply-delay ein; 0 feuert wieder sofort.

             Der saubere Weg bleibt, die Werte aus DIESEM JSON zu lesen statt aus den States des
             Reusables -- date_from und date_to stehen darin. Dann muss nichts synchron sein. */
          var verzug = parseInt(root.getAttribute("data-range-apply-delay"), 10);
          if (!isFinite(verzug) || verzug < 0) verzug = 120;
          setTimeout(function () {
            if (!callFn("data-range-apply-fn", null, json) && window.console) {
              console.warn("[date-range] " + applyName + " ist gesetzt, aber nicht auffindbar — " +
                "diese Aenderung hat keinen seitenweiten Workflow erreicht.");
            }
          }, verzug);
        }
        /* Mit diesem Zeitraum ist die Ansicht jetzt bedient: der Klick hat den Nachlade-Kanal
           gerufen. Ohne diese Zeile haette ein spaeteres Aktivieren sie fuer veraltet gehalten
           und ein zweites Mal nachgeladen. */
        if (grund === "user") STAND[instanceId] = iso(from) + "|" + iso(to) + "|" + (committedPreset || "");
        return rangeGetroffen;
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
        menu.style.marginLeft = "";
        menu.style.marginRight = "";
        var tr = trigger.getBoundingClientRect();
        var vw = document.documentElement.clientWidth || window.innerWidth;
        var mw = menu.offsetWidth;
        var rechts = tr.left + mw > vw - 8;
        if (rechts) menu.classList.add("is-right");
        /* Umklappen allein reicht nicht. Das Panel ist mit zwei Monaten rund 760px breit -- steht
           der Trigger weit rechts in einer Leiste, passt es weder links- noch rechtsbuendig, und
           die rechtsbuendige Variante haengt dann links aus dem Fenster heraus. Also nach der
           Entscheidung nachmessen und den Rest hineinschieben.

           Der Schub muss auf der Seite sitzen, an der das Panel verankert ist: bei left:0 wirkt
           nur margin-left, bei right:0 nur margin-right (und dort mit umgekehrtem Vorzeichen).
           Rand statt left/right, damit die absolute Verankerung am Trigger erhalten bleibt -- so
           wandert das Panel beim Scrollen weiter mit, ganz ohne Scroll-Handler. */
        var mr = menu.getBoundingClientRect();
        var schub = (mr.left < 8) ? (8 - mr.left) : (mr.right > vw - 8 ? (vw - 8 - mr.right) : 0);
        if (schub){
          schub = Math.round(schub);
          if (rechts) menu.style.marginRight = (-schub) + "px";
          else menu.style.marginLeft = schub + "px";
        }
      });

      /* Bei aktivem Schalter sind die nicht teilbaren Zeitraeume ausgegraut: "Letzte 6 Monate"
         und die Auswahl im Kalender. Sonst zeigte diese Ansicht einen Zeitraum, den die naechste
         nicht kennt -- zwei Zeitraeume, waehrend der Schalter behauptet, es waere einer. */
      /* Ein Attribut je Tag. Kein pointer-events: none mehr -- ein Element ohne Zeiger-Ereignisse
         erzeugt kein mouseover, und dann gibt es auch keinen Hinweis. Dass der Klick nichts tut,
         besorgt der Riegel im Klick-Handler (vor dem ERSTEN Klick, siehe dort). */
      function tageSperren(an){
        var tip = t("Turn off Apply everywhere");
        Array.prototype.forEach.call(root.querySelectorAll(".udr-day"), function (d2) {
          if (an) d2.setAttribute("data-tip", tip); else d2.removeAttribute("data-tip");
        });
      }
      function syncSperren(){
        var an = syncAn() && nimmtTeil(instanceId);
        menu.classList.toggle("is-syncon", an);
        /* Der Hinweis haengt an den TAGEN, nicht am ganzen .udr-cal. Der Tooltip wird am
           Rechteck des Elements ausgerichtet, unter dem der Zeiger steht -- bei .udr-cal ist das
           das ganze Monatsraster, und der Hinweis erschien deshalb unter dem Dropdown statt dort,
           wo man hovert. Gemeldet am 03.09.
           Gesetzt wird er beim Zeichnen (render), weil das Raster bei jedem Monatswechsel neu
           entsteht; hier nur der Nachzug fuer das Raster, das gerade steht. */
        if (calEl) calEl.removeAttribute("data-tip");
        tageSperren(an);
        Array.prototype.forEach.call(menu.querySelectorAll(".udr-preset"), function (b) {
          var teilbar = !!TEILBAR[b.getAttribute("data-preset")];
          var aus = an && !teilbar;
          b.disabled = aus;
          if (aus) b.setAttribute("data-tip", t("Turn off Apply everywhere"));
          else b.removeAttribute("data-tip");
        });
      }
      /* Nur die ANZEIGE der anderen Picker nachziehen, ohne deren Bubble-Ereignisse. Alle zehn
         Kalender liegen gleichzeitig im DOM (die Views werden nur versteckt), ein Klick wuerde
         sonst zehn Workflows starten -- genau die Lawine, gegen die die ganze Leistungsrunde
         gelaufen ist. Der geaenderte Picker feuert fuer SEINE Ansicht, die anderen bleiben still.
         Ihre DATEN holen sie sich, wenn ihre Ansicht dran ist: beim Aktivieren erkennt der
         Kalender, dass ihr Zeitraum abweicht, und laedt sie einmal nach (siehe "veraltet" im
         Ansichtswechsel). */
      function syncWeitergeben(key){
        for (var i = 0; i < CONTROLLERS.length; i++) {
          var c = CONTROLLERS[i];
          if (!c || c.instanceId === instanceId || !nimmtTeil(c.instanceId)) continue;
          try { c.setPreset(key, false); } catch (e) {}
        }
        /* HIER STAND EIN resetView() -- und es war der zweite Ladevorgang.
           Es sollte dafuer sorgen, dass die anderen Ansichten neu laden, wenn sie wieder dran
           sind: es raeumt den "schon geladen"-Merker des View-Systems ab, und beim naechsten
           Oeffnen laeuft view_first_<name> erneut. Das war der erste Entwurf, als es noch keine
           Erkennung fuer veraltete Ansichten gab.

           Inzwischen gibt es sie, und sie ist besser: sie laedt nur, wenn der Zeitraum wirklich
           abweicht, und sie setzt die States im SELBEN Workflow vor dem Laden. resetView dagegen
           liess die Ansicht ueber ihren eigenen Weg laden -- mit den States, die zu diesem
           Zeitpunkt noch die alten waren. Beides zusammen ergab zwei Ladevorgaenge: erst der von
           resetView mit alten Daten, dann unser Nachladen mit den richtigen.
           Gemeldet als "triggert dann wieder alle rpcs doppelt, einmal mit alten daten". Zwei
           Mechanismen fuer eine Aufgabe, und einer davon war meiner von vorhin. */
      }

      menu.addEventListener("click", function (e) {
        /* Die ganze Zeile, nicht nur der Schalter: ein 38px breites Ziel neben einer 34px
           breiten Zeile, die genauso aussieht wie die anklickbaren Presets darueber, ist eine
           Falle. */
        var sw = e.target.closest(".udr-sync");
        if (sw) {
          e.stopPropagation();
          if (isProcessing()) return;
          var an = !syncAn();
          /* Beim Einschalten wird der aktuelle Zeitraum uebernommen, wenn er teilbar ist --
             sonst die Vorgabe. Ein eigener Zeitraum kann nicht global gelten, und ihn stumm
             gegen etwas anderes zu tauschen, ohne es zu zeigen, waere schlimmer. */
          if (an) UC.setPref("date_preset", TEILBAR[committedPreset] ? committedPreset : DEFAULT_PRESET);
          UC.setPref("date_sync", an ? "on" : "off");
          /* NEU LADEN und nicht weitergeben. Beim Umschalten sind womoeglich alle Ansichten und
             mehrere Drawer offen, jeder mit eigenem Zustand in Bubble -- die alle einzeln
             nachzuziehen waere ein Netz aus Sonderfaellen. Der Reload stellt Views und Drawer aus
             der URL wieder her (?view= und ?detail=) und jeder Picker liest den gespeicherten
             Stand. Der Schalter wird selten geklickt; das darf einen Aufbau kosten. */
          /* Mit dem Parameter neu laden, nicht bloss neu laden: beim naechsten Aufbau soll Bubble
             den Zeitraum aus der URL kennen, bevor die erste Abfrage laeuft. Beim Ausschalten
             faellt der Parameter weg. Schlaegt das Bauen der URL fehl, bleibt es beim einfachen
             Reload -- der Schalter muss wirken, auch ohne URL-Trick. */
          var ziel = urlAn(root)
            ? urlMit(an ? (TEILBAR[committedPreset] ? committedPreset : DEFAULT_PRESET) : null)
            : null;
          try {
            if (ziel && ziel !== window.location.href) window.location.replace(ziel);
            else window.location.reload();
          } catch (e2) { try { window.location.reload(); } catch (e3) {} }
          return;
        }
        var preset = e.target.closest(".udr-preset");
        if (preset) {
          e.stopPropagation();
          if (isProcessing()) return;
          if (preset.disabled) return;
          var key = preset.getAttribute("data-preset");
          applyPreset(key, true);
          if (syncAn() && nimmtTeil(instanceId) && TEILBAR[key]) {
            UC.setPref("date_preset", key);
            if (urlAn(root)) urlSchreiben(key);
            syncWeitergeben(key);
          }
          pop.close(true);
          return;
        }
        if (e.target.closest(".udr-reset")) {
          e.stopPropagation();
          if (isProcessing()) return;
          applyPreset(DEFAULT_PRESET, true);
          /* Bei aktivem Schalter setzt Reset den GETEILTEN Zeitraum zurueck, nicht nur diesen
             einen -- alles andere waere ein Zustand, in dem der Schalter luegt. */
          if (syncAn() && nimmtTeil(instanceId)) {
            UC.setPref("date_preset", DEFAULT_PRESET);
            if (urlAn(root)) urlSchreiben(DEFAULT_PRESET);
            syncWeitergeben(DEFAULT_PRESET);
          }
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
          /* Bei aktivem Schalter gilt kein eigener Zeitraum: er ist nicht teilbar, und ihn hier
             still zu erlauben ergaebe zwei Zeitraeume gleichzeitig.
             DER RIEGEL STEHT VOR DEM ERSTEN KLICK und nicht erst vor dem zweiten. Vorher stand er
             beim zweiten: der erste Klick bewaffnete die Auswahl, der zweite lief in diesen return
             -- die Auswahl liess sich also weder abschliessen noch abbrechen. Genau so gemeldet
             am 03.09. Die CSS macht die Tage zusaetzlich taub; das hier ist der Riegel dahinter,
             fuer den Fall, dass ein Klick doch ankommt (Tastatur, fremdes Skript). */
          if (syncAn() && nimmtTeil(instanceId)) return;
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
      /* Escape schliesst -- kam vorher von makePopover, steht jetzt hier. Capture-Phase und auf
         document, damit es auch greift wenn der Fokus gar nicht im Panel sitzt (das Panel zieht
         den Fokus bewusst nicht an sich). */
      document.addEventListener("keydown", function (e) {
        if (!isPanelOpen) return;
        if (e.key === "Escape" || e.keyCode === 27) setOpen(false);
      }, true);

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

      /* Beim Aufbau den gespeicherten Stand uebernehmen -- STILL. Der Picker feuert grundsaetzlich
         nicht beim Mounten (emit laeuft nur bei Klick, Reset und eigener Auswahl), und das bleibt
         so: zehn Picker mal drei Bubble-Aufrufe bei jedem Seitenaufbau waere die Lawine an der
         teuersten Stelle. Die Datums-States setzt dein Page-Load-Workflow, indem er
         getUpstreemDateRange() liest -- eine Zeile, einmal. */
      /* urlPreset() zuerst: es ist der Zeitraum, mit dem Bubble diesen Aufbau gefahren hat.
         Anzeige und Daten muessen zusammenpassen, sonst zeigt der Kalender "Last 30 Days" ueber
         Zahlen aus sieben Tagen. */
      if (syncAn() && nimmtTeil(instanceId))
        applyPreset((urlAn(root) && urlPreset()) || syncPreset(), false);
      syncSperren();
      /* Aendert die Einstellung woanders (anderer Picker, Einstellungen), zieht dieser mit. */
      window.addEventListener("up-prefs-change", function (e) {
        var name = e && e.detail && e.detail.name;
        if (name && name !== "date_sync" && name !== "date_preset") return;
        var sw2 = menu.querySelector("[data-udr-sync]");
        if (sw2) sw2.classList.toggle("is-on", syncAn());
        var zeile = menu.querySelector(".udr-sync");
        if (zeile) zeile.setAttribute("aria-checked", syncAn() ? "true" : "false");
        syncSperren();
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
        getRange: function () { return { from: iso(committed.from), to: iso(committed.to), preset: committedPreset }; },
        /* Feuert den aktuellen Stand, ohne ihn zu aendern -- fuer upstreemDatesActivate und die
           Uebergabe beim Aufbau. Der Grund geht mit, damit kein seitenweiter Workflow anspringt. */
        emitCurrent: function (grund) { return emit(committed.from, committed.to, grund || "activate"); },
        /* NUR den Nachlade-Kanal, ohne die States anzufassen -- fuer eine Ansicht, deren Daten von
           einem anderen Zeitraum sind. Die States hat die Uebergabe davor schon gesetzt; hier
           fehlt allein der Ladevorgang. */
        nachladen: function () {
          /* Ohne data-range-apply-fn gibt es nichts zu rufen -- und das darf nicht stumm bleiben.
             Genau so gemeldet am 03.09.: in der Spur stand "range-apply  fn: null  getroffen:
             false", und die Ansicht blieb mit den Zahlen des alten Zeitraums stehen. Der Grund
             ist harmlos und haeufig: wer sein Apply-Event aus dem date_range-Workflow heraus
             ruft, hat das Attribut nie gebraucht. Fuer das Nachladen einer veralteten Ansicht
             braucht es es aber, denn dort gibt es keinen date_range-Aufruf. */
          var p2 = {
            instance_id: instanceId,
            date_from: iso(committed.from), date_to: iso(committed.to),
            preset: committedPreset || "", reason: "stale",
            event_id: instanceId + "_" + Date.now() + "_stale"
          };
          var j2 = JSON.stringify(p2);
          /* Der saubere Weg: der eigene Nachlade-Kanal. */
          if (root.getAttribute("data-range-apply-fn"))
            return callFn("data-range-apply-fn", null, j2);

          /* Sonst der Weg, den die Seite ohnehin hat. Gemessen am 03.09.: auf der echten Seite
             ist data-range-apply-fn nicht gesetzt -- das Apply-Event wird dort am ENDE des
             date_range-Workflows gerufen, aus einem Snippet, das data-range-json vom Element
             liest. Fuer eine veraltete Ansicht gibt es keinen date_range-Aufruf, an den man sich
             haengen koennte, also wird hier einer gemacht: die Attribute wie bei einer Auswahl
             setzen und den Range-Kanal rufen. Der Workflow setzt dann States (dieselben Werte,
             kostet nichts) und ruft sein Apply -- genau ein Ladevorgang.
             data-range-apply steht dabei auf "yes": das ist die Bedingung, an der das Snippet
             erkennt, dass es weiterreichen soll. */
          root.setAttribute("data-range-json", j2);
          /* data-range-reason auf "user", NICHT auf "stale" -- und das ist Absicht.
             Dieses Attribut beantwortet fuer ein Snippet auf der Seite genau eine Frage:
             weiterreichen oder nicht. Ein Snippet mit der Bedingung reason === "user" (die habe
             ich selbst vorgeschlagen) haette ein "stale" geblockt, und dann feuert der Range-Kanal
             richtig, der Workflow laeuft, und trotzdem laedt nichts nach. Genau so gemeldet.
             Der praezise Grund steht im JSON (reason: "stale") -- dort, wo ein Workflow ihn lesen
             kann, ohne dass eine Bedingung davon abhaengt. */
          root.setAttribute("data-range-reason", "user");
          root.setAttribute("data-range-apply", "yes");
          return callFn("data-range-fn", "bubble_fn_udr_date_range", j2);
        }
      };
      root.__udrCtrl = ctrl;
      CONTROLLERS.push(ctrl);
      /* Der Aufbau-Fall: der erste teilnehmende Kalender der Seite gibt seinen Zeitraum an
         Bubble. setTimeout(0) und nicht sofort: dieser Aufruf loest einen Bubble-Workflow aus,
         und der soll nicht mitten im Mounten dieses Elements laufen.
         Die Abfrage steht VOR dem setTimeout, nicht nur darin: sonst legen zehn Picker zehn
         Timer, von denen neun sofort wieder aussteigen. Einer reicht. */
      /* Genau EINE Warteschleife fuer die Seite. Vorher startete jeder teilnehmende Picker eine
         eigene -- bei fuenf Ansichten fuenf Schleifen, und im Log der echten Seite entsprechend
         fuenf Bloecke pro Runde. */
      if (!aufbauLaeuft && !bootGetan() && nimmtTeil(instanceId)){
        aufbauLaeuft = true;
        setTimeout(function(){ aufbauUebergeben(ctrl); }, 0);
      }

      /* Tooltips. Dieser Kalender hat sie NIE eingeschaltet -- data-tip stand an den Presets seit
         langem, ohne dass jemals einer erschien, und beim neuen Schalter fiel es auf. Dieselbe
         eine Zeile wie in den drei Geschwister-Filtern (topics/markets/models), dieselbe
         geteilte Umsetzung in core. Das Panel liegt IM Element (position: absolute, kein Portal),
         der Beobachter an der Wurzel erreicht es also. */
      if (UC.makeTooltips) UC.makeTooltips(root, function () {
        return root.getAttribute("data-theme") === "dark";
      });

      syncConfig(); paint(); render();

      /* Alles nachholen, was diesen Kalender angefragt hat, bevor es ihn gab. Dieselbe Regel
         (exakt oder Praefix) wie beim lebenden Aufruf, damit ein wartendes
         resetUpstreemDateRangePicker('dates_v2_') ihn auch erreicht. */
      if (spaet) spaet.drain(instanceId, ctrl);
      return ctrl;
    }

    /* Exact match OR prefix. The standalone's documented call is
       resetUpstreemDateRangePicker('dates_v2_') -- a PREFIX, which is why the id in the docs ends
       in an underscore -- and this function compared with === only, so that documented form
       matched nothing and returned false silently. Prefix can only widen the match, never break an
       exact one, so both spellings now work.
       And when nothing matches at all, say so with the ids that DO exist instead of returning a
       quiet false: a reset that hits no picker is always a typo or a not-yet-mounted element, and
       neither is diagnosable from a bare `false` in a Bubble workflow. */
    function forEachInstance(instanceId, fn) {
      var id = String(instanceId || "").trim();
      var hit = false;
      CONTROLLERS = CONTROLLERS.filter(function (c) { return c.root && c.root.isConnected; });
      /* Genauer Name schlaegt Praefix. Auf der echten Seite heisst ein Filter "..._prompts" und
         ein zweiter "..._promptspotlight" -- der erste Name ist ein Praefix des zweiten, und der
         Aufruf fuer die Prompts-Seite bediente damit STILL auch das Prompt-Spotlight (gemessen
         02.09. auf der laufenden App). Die dokumentierte Praefix-Form (etwa "dates_v2_") bleibt
         erhalten: sie greift weiter, sobald es keinen genauen Treffer gibt. */
      var genau = id ? CONTROLLERS.some(function (c) { return c.instanceId === id; }) : false;
      CONTROLLERS.forEach(function (c) {
        if (!id || (genau ? c.instanceId === id : c.instanceId.indexOf(id) === 0)) { fn(c); hit = true; }
      });
      /* Nothing matched -- park it instead of dropping it. A Bubble workflow routinely calls this
         while the group holding the picker is still hidden, and Bubble does not render a hidden
         group's HTML at all, so there is genuinely no element yet: initRoot never even runs, which
         is why the failure carries no mount error. Held here and replayed the moment a picker with
         that id mounts (see the drain in initRoot), so the call order stops mattering. Latest wins
         per id -- two resets queued for the same picker mean the same end state, not two runs. */
      if (!hit && id && spaet) spaet.park(id, fn);
      return hit;
    }
    /* Per-root try/catch: one root failing to mount must not abort the sweep for the others, and
       the reason has to end up in the console. Unguarded, a throw inside initRoot propagated out
       of here and took the whole API call with it -- the reset that triggered the sweep never ran
       and there was nothing to see but a picker that did not react. */
    function initAll() {
      Array.prototype.forEach.call(document.querySelectorAll(".udr-root, [data-udr-root]"), function (r) {
        try { initRoot(r); }
        catch (e) {
          if (window.console) console.error("[date-range] mount failed for instance \"" +
            (r && r.getAttribute ? (r.getAttribute("data-instance") || "(no id)") : "?") + "\":", e);
        }
      });
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
    /* ---- Fuer Bubble ------------------------------------------------------------------------
     Im Normalbetrieb ist NICHTS zu rufen. Der Seitenaufbau kennt den Zeitraum aus der URL
     (data-url-range="on" plus ein Page-Load-Schritt, der ?range= liest), und der Ansichtswechsel
     laeuft ueber core's showView-Umschliessung.

     getUpstreemDateRange()  liest den GETEILTEN Zeitraum, oder null wenn der Schalter aus ist.
                             Fuer die Konsole. ACHTUNG: ein "Run javascript"-Schritt in Bubble
                             gibt keinen Wert an den Workflow zurueck -- er muesste ueber ein
                             JavaScriptToBubble-Element hinein.
     upstreemDatesActivate(name)  sagt "diese Ansicht ist jetzt dran": der Picker dieser Ansicht
                             gibt seinen Zeitraum einmal an Bubble. Noetig, wenn die Seite eine
                             Ansicht OHNE showView() umschaltet -- dann sieht core den Wechsel
                             nicht. Feuert immer, auch wenn schon uebergeben wurde. */
  window.getUpstreemDateRange = function () {
    if (!(UC.getPref && UC.getPref("date_sync") === "on")) return null;
    var p = UC.getPref("date_preset");
    for (var i = 0; i < CONTROLLERS.length; i++) {
      var c = CONTROLLERS[i];
      if (c && c.root && c.root.isConnected && typeof c.getRange === "function"){
        var r = c.getRange();
        if (r && r.preset === p) return { preset: p, from: r.from, to: r.to };
      }
    }
    /* Kein Picker im Dokument, der schon auf dem Preset steht -- dann nur den Namen zurueckgeben.
       Die Daten daraus zu rechnen ist Sache des Kalenders, nicht dieser Zeile. */
    return { preset: p, from: null, to: null };
  };
  /* Der Picker einer Ansicht: der View-Name steckt im Instanznamen (view "prompts" ->
     dates_v2_prompts). Ein genauer Vergleich waere falsch -- der Aufrufer kennt den View-Namen,
     nicht die volle Instanz-Id. Ein reines "enthaelt" ist aber auch falsch, und das ist derselbe
     Praefix-Stolperstein wie in forEachInstance: "prompts" steckt AUCH in
     "dates_v2_prompt_spotlight". Darum zuerst das Ende vergleichen -- der Instanzname endet auf
     den View-Namen -- und nur wenn das nichts findet, auf "enthaelt" zurueckfallen. */
  function pickerFuer(name){
    var id = String(name || "").trim(), i, c;
    if (!id) return null;
    var da = [];
    for (i = 0; i < CONTROLLERS.length; i++){
      c = CONTROLLERS[i];
      if (c && c.instanceId && c.root && c.root.isConnected) da.push(c);
    }
    for (i = 0; i < da.length; i++) if (da[i].instanceId.slice(-id.length) === id) return da[i];
    for (i = 0; i < da.length; i++) if (da[i].instanceId.indexOf(id) >= 0) return da[i];
    return null;
  }

  /* ---------- Wer sagt Bubble den geteilten Zeitraum? ----------
     Bis hierher stand in der Doku: "lies getUpstreemDateRange() im Page-Load-Workflow und rufe
     upstreemDatesActivate(name) in bubble_fn_view_changed". Beides ist Handarbeit in Bubble, und
     beides ist unnoetig -- die Seite kann es selbst:

       Seitenaufbau   der erste teilnehmende Picker gibt seinen Zeitraum einmal an Bubble, und
                      zwar SOBALD ER GEMOUNTET IST (initRoot ruft aufbauUebergeben). Nicht nach
                      einer Frist und nicht abhaengig von Sichtbarkeit -- daran ist der erste
                      Anlauf gescheitert.
       Ansichtswechsel core umschliesst showView der Host-App und meldet den Wechsel VOR dem
                      Original (UC.onViewChange). Der Picker dieser Ansicht gibt seinen Zeitraum.

     Gegeben wird er ueber dieselben drei Funktionen wie bei einem Klick im Kalender
     (bubble_fn_udr_date_from/to/range). Der Workflow, der heute auf eine Datumsauswahl reagiert,
     reagiert also auch hier -- ohne neuen State, ohne neues JavaScriptToBubble-Element. Und weil
     dieser Workflow selbst laedt, gibt es kein Wettrennen mit showView: der Ladevorgang haengt am
     Aufruf, nicht an der Reihenfolge zweier Bubble-Ereignisse.

     NUR BEI AKTIVEM SCHALTER. Ist er aus, feuert ein Ansichtswechsel wie bisher nichts -- ein
     Kalender, der beim Umschalten ploetzlich Workflows startet, waere eine neue Nebenwirkung fuer
     jeden, der die Funktion nie eingeschaltet hat.

     UND NUR EINMAL JE PICKER. Sind die Datums-States der Seite global, reicht der erste Aufruf
     fuer alle Ansichten; sind sie je Ansicht getrennt, braucht jede genau einen. Ohne den Merker
     waeren es drei Bubble-Aufrufe bei JEDEM Umschalten, auch wenn sich nichts geaendert hat. Der
     Merker haelt hoechstens fuenf Eintraege und wird geleert, sobald sich der geteilte Zeitraum
     aendert -- danach holt sich jede Ansicht die neuen Daten beim naechsten Aktivieren. */
  var UEBERGEBEN = {};
  /* Der Merker wird erst NACH dem Erfolg gesetzt. Vorher stand er davor -- eine Uebergabe, die
     keinen einzigen Bubble-Kanal traf, galt damit als erledigt: der Aufbau lief ins Leere UND der
     spaetere Ansichtswechsel wurde uebersprungen ("schonUebergeben: true" bei falschem Zeitraum).
     Gemeldet am 03.09., und im Log der Seite genau so zu sehen. */
  function uebergeben(c, grund){
    if (!c || UEBERGEBEN[c.instanceId] || typeof c.emitCurrent !== "function") return false;
    var ok = c.emitCurrent(grund || "activate");
    if (ok){
      UEBERGEBEN[c.instanceId] = 1;
    }
    return !!ok;
  }
  /* Ein Aufruf von aussen ist eine ausdrueckliche Anweisung und feuert IMMER -- der Merker haelt
     nur die automatischen Uebergaben auseinander. */
  /* Mit WELCHEM Zeitraum sind die Daten einer Ansicht geladen? Der gemeldete Fall (03.09.):
     Dashboard mit last30 aufgebaut, in Citations auf last3 gewechselt, zurueck zum Dashboard --
     Kalender und URL stehen auf last3, die Zahlen im Dashboard sind aber noch die von last30.
     Die States stimmen (die Uebergabe setzt sie), es fehlt allein der Ladevorgang: State-Setzen
     laedt nichts nach, und das ist Absicht -- sonst haetten wir den doppelten Durchlauf zurueck.
     Also wird mitgeschrieben, mit welchem Zeitraum jede Ansicht zuletzt bedient wurde. Weicht er
     beim Aktivieren ab, wird EINMAL nachgeladen, und zwar nur diese Ansicht. Eine Alternative
     waere, bei jeder Aenderung die ganze Seite neu zu laden -- der Aufbau kostet dort 9 Sekunden,
     also nein. */
  var STAND = {};
  function sigVon(c){
    try {
      var r = typeof c.getRange === "function" ? c.getRange() : null;
      return r ? (r.from + "|" + r.to + "|" + (r.preset || "")) : null;
    } catch(e){ return null; }
  }
  window.upstreemDatesActivate = function (name) {
    var c = pickerFuer(name);
    /* In die Spur, mit Ergebnis. Der Aufruf steht auf der echten Seite in view_first_<name>, also
       an einer Stelle, an der ein stilles false teuer ist: dann laeuft die Ansicht ohne Zeitraum.
       Und er ersetzt dort einen DOM-Umweg, der genau daran gescheitert ist -- im Log des Nutzers
       kam bubble_fn_udr_date_boot_dashboard ein zweites Mal an, mit dem Wert null, und
       ueberschrieb die richtigen Datumsangaben von einer Sekunde davor. Diese Funktion kann kein
       null schicken: sie liest den Stand des Pickers, nicht ein Attribut, das erst geschrieben
       werden muss. */
    if (!c || typeof c.emitCurrent !== "function") return false;
    UEBERGEBEN[c.instanceId] = 1;
    return c.emitCurrent();
  };
  /* EINMAL JE SEITENAUFBAU, und der Merker sitzt am WINDOW statt im Modul. Der Grund ist
     date-range.js ZWEIMAL geladen -- zwei Komponenten, zwei CDN-Einbindungen. Dann laeuft udrBoot
     zweimal, jeder Lauf baut seine eigene CONTROLLERS-Liste (initRoot haengt den vorhandenen
     Controller ausdruecklich in die neue Liste), und jeder Lauf wuerde uebergeben. Ein Merker im
     Modul haette das nicht gesehen. */
  function bootGetan(){ return !!window.__udrBootGetan; }
  function bootMerken(){ try { window.__udrBootGetan = true; } catch(e){} }

  /* upstreemDatesBoot() ist RAUS. Es rechnete den geteilten Zeitraum ohne gemounteten Kalender
     aus und schob ihn an Bubble -- gedacht als EIN Schritt im Page-Load-Workflow. Zwei Dinge haben
     es ueberholt: der Zeitraum steht bei aktivem data-url-range in der URL, also kennt Bubble ihn
     vor der ersten Abfrage ganz ohne JavaScript; und wo das nicht eingerichtet ist, uebergibt der
     Kalender beim Mounten von selbst. Auf der echten Seite kam der Aufruf ohnehin immer zu spaet
     ("kam zu spaet: der Zeitraum wurde beim Aufbau schon uebergeben") -- er war ein Nullvorgang
     mit einer Konsolenzeile. Wer den Zeitraum von aussen setzen will, nimmt
     upstreemDatesActivate(view). */
  var STARTANSICHT_GEKLAERT = false;
  function startansichtNachtragen(){
    if (STARTANSICHT_GEKLAERT) return;
    STARTANSICHT_GEKLAERT = true;
    for (var i = 0; i < CONTROLLERS.length; i++){
      var c = CONTROLLERS[i];
      if (!c || !c.root || !c.root.isConnected || !nimmtTeil(c.instanceId)) continue;
      if (STAND[c.instanceId]) continue;
      if (c.root.offsetParent === null) continue;
      var sg = sigVon(c);
      if (!sg) continue;
      STAND[c.instanceId] = sg;
    }
  }
  if (UC.onViewChange) UC.onViewChange(function (name) {
    if (!name) return;
    startansichtNachtragen();
    if (!syncAn()){ return; }
    if (!nimmtTeil(name)){ return; }
    var c = pickerFuer(name);
    if (!c){ return; }
    if (!nimmtTeil(c.instanceId)){
      return;
    }
    /* Der Wechsel uebergibt -- und zwar ueber den Aufbau-Kanal, also NUR States, ohne Nachladen.
       Zwei Fehlgriffe davor: erst ging er ueber den Range-Kanal (das war der zweite Durchlauf beim
       Wechsel), dann war er ganz abgeschaltet, weil ich die States fuer seitenweit hielt. Gemessen
       ist beides widerlegt: die Citations-Ansicht lud danach mit p_date_from: null. Jede Ansicht
       hat eigene Datums-States, jede braucht ihre Uebergabe -- nur eben eine stille. */
    var sig = sigVon(c), alt = STAND[c.instanceId];
    var veraltet = !!(alt && sig && alt !== sig);
    /* Bei einer VERALTETEN Ansicht wird der Aufbau-Kanal uebersprungen. Zwei Bubble-Ereignisse
       fuer einen Wechsel waren einer zu viel, und im Log des Nutzers stand genau das:

         +17995  kanal boot  -> States setzen
         +18259  kanal range -> States setzen UND nachladen

       Der Boot-Aufruf loest auf dieser Seite einen Ladevorgang aus, und zwar mit States, die noch
       nicht angekommen sind -- also mit den ALTEN Daten. Danach laedt der Range-Aufruf noch einmal
       richtig. Gemeldet als "einmal mit alten Daten, voellig unnoetig".
       Der Range-Kanal kann beides in EINEM Workflow, in der richtigen Reihenfolge: erst die States
       setzen, dann das Apply. Fuer eine veraltete Ansicht ist er also der ganze Vorgang.
       Ist die Ansicht NICHT veraltet, bleibt es beim Aufbau-Kanal allein: dort soll nichts laden. */
    if (!veraltet) uebergeben(c);
    /* Veraltet: diese Ansicht wurde schon einmal mit einem ANDEREN Zeitraum bedient. Dann fehlt
       nach der Uebergabe nur noch der Ladevorgang -- und den kennt der Nachlade-Kanal.
       Beim ERSTEN Aktivieren (alt ist leer) nicht: dort laedt die Ansicht ueber ihren eigenen
       Workflow, und ein zweiter Aufruf waere der doppelte Durchlauf. */
    if (veraltet && typeof c.nachladen === "function"){
      UEBERGEBEN[c.instanceId] = 1;
      /* NACH dem Umschalten, nicht davor. core meldet den Ansichtswechsel VOR dem Original von
         showView -- die neue Ansicht ist in diesem Moment noch versteckt. Die Uebergabe der
         States darf und soll dort liegen (sie muss vor dem Laden stehen), ein REFRESH aber nicht:
         eine Bubble-Gruppe, die noch nicht sichtbar ist, laedt nicht oder verwirft das Ergebnis.
         Genau das Bild: der Range-Kanal traf (getroffen: true), der Workflow lief, und nichts
         aenderte sich.
         250ms, nicht 0: showView blendet die Gruppe im naechsten Task ein, und Bubble braucht
         danach noch einen Durchgang, bis sie als sichtbar gilt. */
      setTimeout(function(){
        if (!c.root || !c.root.isConnected) return;
        c.nachladen();
      }, 250);
    }
    if (sig) STAND[c.instanceId] = sig;
  });
  window.addEventListener("up-prefs-change", function (e) {
    var n = e && e.detail && e.detail.name;
    if (!n || n === "date_preset" || n === "date_sync") UEBERGEBEN = {};
  });
  window.setDateRangeTheme = function (instanceId, theme) {
      initAll();
      return forEachInstance(instanceId, function (c) { c.setTheme(theme); });
    };

    initAll();
    if (UC.watchRoots) UC.watchRoots("udr-root", initAll);

    /* Die Aufbau-Uebergabe steht jetzt in initRoot -- hier ist nichts mehr zu tun.
       IMMER, nicht nur bei aktivem Schalter. Vorher hing diese Uebergabe an syncAn(), und damit
       gab es keinen verlaesslichen Moment, an dem Bubble den Anfangszeitraum erfaehrt: mit
       Schalter aus kam nichts, also musste die Seite ihn selbst setzen -- und genau dieses
       Startup-Event hat dann die Uebergabe mit Schalter AN wieder ueberschrieben. Gemeldet am
       03.09.: die RPCs liefen mal mit null, mal doppelt (erst null, dann richtig).
       Mit dieser Zeile gibt es EINEN Moment fuer beide Faelle: Schalter an -> der geteilte
       Zeitraum, Schalter aus -> der eigene Stand des Pickers. Ein Workflow, der am
       reason "boot" haengt, laedt damit genau einmal und immer mit gesetzten Datumsangaben.
       Der seitenweite Kanal bleibt dabei still (siehe emit), es entsteht also kein zweiter
       Ladevorgang fuer den, der weiter beim Seitenaufbau laedt. */
    /* ---- DER AUFBAU HAENGT AM MOUNT, NICHT AN DER UHR --------------------------------------
       Der Defekt hinter "bei Seitenwechsel geht es, beim Seitenaufbau nicht": diese Uebergabe
       lief EINMAL, einen Makrotask nach dem Laden dieser Datei, und verlangte einen SICHTBAREN
       Picker. Beim Seitenaufbau ist zu diesem Zeitpunkt keiner sichtbar -- Bubble blendet seine
       Gruppen erst danach ein --, also passierte nichts, nie wieder. Beim Ansichtswechsel greift
       UC.onViewChange, der spaeter laeuft; darum ging das eine und das andere nicht.

       KEIN Warten und KEIN Nachsehen im Takt. Ein Anlauf mit 150ms-Runden waeren bis zu 54 Timer
       gewesen, jeder mit einem offsetParent -- also erzwungenem Layout auf einer Seite mit 24000
       Knoten, wo ein Durchlauf 6ms kostet. Genau die Bauart, die in der Leistungsrunde
       herausgeworfen wurde.

       Stattdessen haengt die Uebergabe am MOUNT: initRoot ruft sie, sobald ein teilnehmender
       Kalender fertig ist. Das ist genau der Moment, in dem es etwas zu uebergeben gibt, und er
       kommt ohne Timer und ohne Beobachter -- UC.watchRoots gibt es ohnehin schon.

       Die Sichtbarkeitspruefung ist ganz weg, und damit auch der Layout-Lesezugriff. Sie sollte
       unter zehn Pickern den richtigen finden. Sie ist unnoetig: Bubble rendert das Markup einer
       verborgenen Gruppe nicht, beim Aufbau ist also ohnehin nur der Kalender der Startansicht da.
       Und sind doch mehrere da, zeigen sie bei aktivem Schalter denselben Zeitraum. */
    /* WARTEN AUF BUBBLES BRUECKE -- PRUEFEN, NICHT RUFEN.
       Im Log der echten Seite standen 16 Runden mit je 20 Aufrufen ins Leere: der erste Anlauf
       hat in jeder Runde die ganze Uebergabe gefeuert und erst hinterher gemerkt, dass niemand
       zuhoert -- und das fuenffach, weil JEDER teilnehmende Picker seine eigene Schleife fuhr.
       Daher die Logflut, und daher der Eindruck, es passiere staendig etwas.

       Jetzt wird nur nachgesehen, ob die Funktion am Fenster STEHT: ein resolveBubbleFn, also ein
       window[name]-Zugriff. Kein Aufruf, kein Layout, kein Beobachter. Und es laeuft genau EINE
       Schleife fuer die ganze Seite -- der erste teilnehmende Picker uebernimmt sie. */
    var AUFBAU_MS = 250, AUFBAU_MAX = 40;
    var aufbauLaeuft = false;
    /* Steht der Kanal, ueber den der Aufbau gehen wird? Reine Abfrage, kein Aufruf.
       Der Aufbau-Kanal zuerst, der Range-Kanal als dokumentierter Rueckfall -- dieselbe
       Reihenfolge wie in emit(), damit hier nicht auf etwas anderes gewartet wird als gerufen. */
    function bootKanal(root){
      var b = root.getAttribute("data-boot-fn") || "bubble_fn_udr_date_boot";
      if (typeof UC.resolveBubbleFn(b) === "function") return "boot";
      var r = root.getAttribute("data-range-fn") || "bubble_fn_udr_date_range";
      if (typeof UC.resolveBubbleFn(r) === "function") return "range";
      return null;
    }
    /* KEINE Bedingung mehr vor der Uebergabe -- und das ist die Ruecknahme eines Fehlers von mir.
       Ich hatte zwei Ausnahmen eingebaut ("Schalter aus" und "der Zeitraum steht in der URL"), die
       beide davon ausgingen, dass die Seite ihren Anfangszeitraum selbst kennt. Gemessen auf der
       echten Seite: sie kennt ihn nicht mehr -- das hart verdrahtete Startup-Event ist raus, und
       den URL-Parameter liest dort niemand. Ergebnis: p_date_from: null, also gar kein Zeitraum.
       Ein doppelter Ladevorgang mit richtigen Daten ist schlimm; ein einzelner ohne Daten ist
       schlimmer. Also uebergibt der Aufbau IMMER, genau einmal, ueber den Aufbau-Kanal. */
    /* Traegt die URL den geteilten Zeitraum SCHON -- und liest die Seite ihn auch? Dann ist die
       Uebergabe ueberfluessig: Bubble hat ihn dann bei 0ms aus dem URL-Parameter, lange vor der
       ersten Abfrage, und unsere waere ein zweiter Zustandswechsel ohne neue Information.

       BEIDE Bedingungen, und das ist der Unterschied zum ersten Anlauf: der sprang schon bei
       einem Parameter in der URL ab, ohne zu wissen, ob die Seite ihn ueberhaupt abfragt. Auf der
       echten Seite tat sie es nicht -- Ergebnis: p_date_from: null, gemeldet als "das hat
       ueberhaupt nicht funktioniert". data-url-range="on" ist die Zusage der Seite, dass sie den
       Parameter im Page-Load-Workflow liest. Ohne die Zusage wird uebergeben. */
    function urlHatIhnSchon(root){
      if (!syncAn() || !urlAn(root)) return null;
      var u = urlPreset();
      if (!u || u !== syncPreset()) return null;
      return 'die URL trug "' + u + '" und data-url-range="on" steht am Element -- Bubble ' +
             'kannte den Zeitraum vor der ersten Abfrage';
    }
    function aufbauUebergeben(c, rest){
      if (bootGetan() || !c || !c.instanceId || !nimmtTeil(c.instanceId)) return;
      if (rest == null) rest = AUFBAU_MAX;
      if (rest === AUFBAU_MAX){
        var unnoetig = urlHatIhnSchon(c.root);
        if (unnoetig){
          bootMerken();
          /* Die Startansicht laedt gleich mit genau diesem Zeitraum -- festhalten, sonst gilt sie
             beim ersten Zurueckkehren als veraltet und wird ohne Not nachgeladen. */
          var s0 = sigVon(c); if (s0) STAND[c.instanceId] = s0;
          return;
        }
      }

      if (!c.root || !c.root.isConnected){
        /* Bubble hat das Element ersetzt. Den Platz freigeben, sonst wartet niemand mehr:
           die neue Wurzel mountet gleich und soll die Schleife uebernehmen duerfen. */
        aufbauLaeuft = false;
        return;
      }
      var kanal = bootKanal(c.root);
      if (kanal){
        /* Wache legen, BEVOR wir selbst rufen: dann steht unser eigener Aufruf als erste Zeile
           drin, und alles danach ist fremd. */
        bootMerken();
        uebergeben(c, "boot");
        var s1 = sigVon(c); if (s1) STAND[c.instanceId] = s1;
        /* Ab jetzt steht der Zeitraum in der URL. Der naechste Aufbau braucht diese Uebergabe
           deshalb nicht mehr -- und damit auch keinen zweiten Abfragedurchlauf. */
        if (syncAn() && urlAn(c.root)) urlSchreiben(syncPreset());
        return;
      }
      if (rest > 0){
        setTimeout(function(){ aufbauUebergeben(c, rest - 1); }, AUFBAU_MS);
        return;
      }
    }

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
