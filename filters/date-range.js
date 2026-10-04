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
    /* Der Export-Kalender bleibt aussen vor: ein Export ist eine eigene Handlung mit eigenem
       Zeitraum. Die Spotlight-Kalender in den Drawern nehmen seit dem 04.09. teil -- angefordert,
       und es ist auch das erwartbare Verhalten: "ueberall anwenden" heisst ueberall. */
    function nimmtTeil(id){ return !/export/i.test(String(id || "")); }
    /* Die Uebergabe beim Seitenaufbau darf NUR ein Ansichts-Kalender machen, nie ein Drawer.
       Sonst gewinnt der Kalender, der zufaellig zuerst mountet, das Rennen -- und ein
       Drawer-Kalender hat keinen data-boot-fn, also wartet die Schleife 40 Runden vergeblich und
       blockiert dabei (aufbauLaeuft) die Uebergabe der wirklich sichtbaren Ansicht. Seit die
       Drawer am geteilten Zeitraum teilnehmen, ist das kein Randfall mehr, sondern
       Mount-Reihenfolge. */
    function istStartkandidat(id){
      return nimmtTeil(id) && !lokal(id) && !/spotlight|drawer/i.test(String(id || ""));
    }
    /* ---- DER LOKALE KALENDER (data-local="yes", 04.10. fuer Shopping) -----------------------
       Wie data-local an den drei Geschwister-Filtern (models/markets/topics): die Auswahl verlaesst
       die Seite NICHT. Kein bubble_fn_udr_*, keine Warnung ueber fehlende Kanaele -- die Komponente,
       in der er steht, liest das DOM-Ereignis "change" (bzw. getRange) und laedt selbst.
       Er ist darum auch weder Startkandidat (keine Uebergabe beim Seitenaufbau) noch ein
       Drawer-Kalender, und pickerFuer findet ihn nicht: diese Wege geben Zeitraeume an
       Bubble-States, und die hat ein lokaler Kalender nicht. Am geteilten Zeitraum ("Apply
       everywhere") nimmt er weiter teil -- das ist eine Einstellung des Nutzers, kein Bubble-Weg. */
    var LOKAL = window.__udrLokal || (window.__udrLokal = {});
    function lokal(id){ return !!LOKAL[String(id || "")]; }
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
    /* ---- WELCHE ANSICHT IST OFFEN? DIE URL WEISS ES AUCH -------------------------------
       Die App fuehrt ?view= in der Adresse mit (dasselbe, was urlMit unten ausdruecklich stehen
       laesst). Das ist die zweite Quelle neben showView -- und die einzige, die schon beim
       Seitenaufbau da ist: showView hat dann noch nicht gefeuert, ein Deeplink oder ein Reload
       auf einer Ansicht liefert also nur ueber die URL eine Antwort.

       Reihenfolge: showView schlaegt die URL. Der Aufruf ist das frischere Ereignis (die App
       koennte die Adresse spaeter oder gar nicht nachziehen), die URL ist der Anfangswert.

       Kein Attribut noetig, anders als bei ?range: hier wird nur GELESEN. Geschrieben wird die
       Adresse der App nur mit data-url-range="on", und daran aendert das nichts.
       Ohne den Fenster-Test von urlNutzbar: der ist dort noetig, weil ein about:blank-Rahmen die
       URL seines Erzeugers meldet und ein SCHREIBEN darauf die Elternseite in den Rahmen laedt.
       Beim Lesen ist derselbe Effekt harmlos -- schlimmstenfalls steht dort der Name einer
       Ansicht, zu der es in diesem Dokument keinen Kalender gibt, und pickerFuer findet nichts. */
    function urlAnsicht(){
      try {
        var m = /[?&]view=([^&#]*)/.exec(window.location.search || "");
        var v = m ? decodeURIComponent(m[1]).trim() : "";
        return v || "";
      } catch (e) { return ""; }
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
    var ICON_CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg>';
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
      var istLokal = UC.isYes ? UC.isYes(root.getAttribute("data-local")) : root.getAttribute("data-local") === "yes";
      if (istLokal) LOKAL[instanceId] = 1;

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
                    esc(t("Same range everywhere")) + '">' +
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
            '<div class="udr-grid">' + (function(){
            var zellen = gridCells(ms);
            /* ERST alle gefaerbten Zellen bestimmen, DANN die Ecken. Eine Ecke ist nur sichtbar,
               wenn auf dieser Seite nichts Gefaerbtes anschliesst -- das laesst sich an einer
               einzelnen Zelle nicht entscheiden, also braucht es die Nachbarn.
               Die Platzhalter fremder Monate sind nie gefaerbt (siehe unten) und wirken damit als
               Kante: das ist richtig, denn dort ist das Band wirklich zu Ende. */
            var gefaerbt = zellen.map(function(d){
              if (d.getMonth() !== ms.getMonth()) return false;
              if (d < b.lo || d > b.hi) return false;
              return !!(range && d >= range.from && d <= range.to);
            });
            return zellen.map(function (d, i) {
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
              /* Sieben Spalten, danach bricht die Zeile um: der linke Nachbar der ersten Spalte
                 steht in der Zeile DARUEBER und ist hier kein Nachbar. */
              if (gefaerbt[i]) {
                if (i % 7 === 0 || !gefaerbt[i - 1]) cls += " is-edge-l";
                if (i % 7 === 6 || !gefaerbt[i + 1]) cls += " is-edge-r";
              }
              return '<button type="button" class="' + cls + '" data-d="' + iso(d) + '"' +
                     (disabled ? " disabled" : "") + ' tabindex="' + (out ? -1 : 0) + '"' +
                     /* Der Hinweis gleich mit ins Markup: das Raster wird bei jedem Monatswechsel
                        neu gebaut, ein Nachtrag von aussen kaeme jedes Mal zu spaet. */
                     (gesperrt ? ' data-tip="' + esc(t("Turn off Apply everywhere")) + '"' : "") + '>' +
                     d.getDate() + "</button>";
            }).join(""); })() + "</div>" +
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
        if (istLokal) return false;
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
        grund = grund || "user";
        /* Eine reine State-Uebergabe haengt nicht am Ladezustand (29.09.): sie laedt nichts, und
           sie steht jetzt unmittelbar vor view_first -- genau dann, wenn die Seite ohnehin laedt.
           Der Riegel ist fuer Klicks in einen Kalender, dessen Tabelle gerade laedt. */
        if (grund !== "boot" && grund !== "activate" && isProcessing()) return false;
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
        /* Ein Klick setzt die States dieses Kalenders (Range-Kanal) und laedt seine Ansicht nach
           (Apply). Beides festhalten (29.09.): vorher blieb STAND auf dem alten Zeitraum stehen,
           und beim Zurueckkehren galt die Ansicht, in der geklickt wurde, als veraltet -- sie lud
           ein zweites Mal, obwohl sie laengst den neuen Zeitraum zeigte. */
        if (grund === "user") {
          var sigKlick = payload.date_from + "|" + payload.date_to + "|" + payload.preset;
          STAND[instanceId] = sigKlick;
          gegebenMerken(instanceId, sigKlick);
        }
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
        /* Lokal: das DOM-Ereignis darueber IST die Zustellung -- kein Kanal, keine Warnung. */
        if (istLokal) return true;
        if (istBoot) {
          if (callFn("data-boot-fn", "bubble_fn_udr_date_boot", json)) return true;
          /* Der Hinweis auf das fehlende Element NUR, wenn der Range-Kanal wirklich da ist.
             Sonst ist nicht ein Element unvollstaendig, sondern die Bruecke nach Bubble steht
             noch gar nicht -- und die Meldung schickte den Nutzer auf die falsche Spur (genau so
             passiert: sie nannte das boot-Element, waehrend keine einzige bubble_fn existierte). */
          /* KEIN RUECKFALL MEHR AUF DEN RANGE-KANAL (29.09.). An ihm haengt der Nachlade-
             Workflow; eine Uebergabe darueber war deshalb immer ein Ladevorgang -- und weil die
             Ansicht ueber view_first ohnehin laedt, der zweite. Gemeldet, mehrmals: "es triggert
             alles doppelt". Fehlt der Boot-Kanal, wird das jetzt gesagt statt ueberbrueckt: EINE
             Zeile je fehlendem Element, mit dem Namen, den es in Bubble tragen muss. */
          var bootName = root.getAttribute("data-boot-fn") || "bubble_fn_udr_date_boot";
          var rangeDa = typeof UC.resolveBubbleFn(
            root.getAttribute("data-range-fn") || "bubble_fn_udr_date_range") === "function";
          var gesagt = window.__udrBootFehlt || (window.__udrBootFehlt = {});
          if (rangeDa && !gesagt[bootName] && window.console) {
            gesagt[bootName] = 1;
            console.warn("[date-range] " + bootName + " gibt es nicht. Ohne diesen Kanal bekommt " +
              "die Ansicht ihren Zeitraum nicht vor dem Laden und zeigt den vom Seitenaufbau. " +
              "Abhilfe: ein JavaScriptToBubble mit diesem Namen anlegen und in seinem Workflow " +
              "NUR die beiden Datums-States aus date_from und date_to setzen, ohne Refresh.");
          }
          return false;
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
        /* ?range= folgt dem geteilten Zeitraum, gleich in welchem Kalender er geaendert wurde --
           sobald IRGENDEIN Kalender der Seite die Adresse fuehrt (29.09.). Vorher schrieb nur
           ein Kalender MIT data-url-range, und ein Wechsel in einem anderen liess sie stehen.
           NUR hier, im Klickpfad: 22137bd schrieb sie aus dem Einstellungs-Ereignis, und das lief
           auch beim Seitenaufbau. */
        if (!urlAn(root)) {
          for (var u = 0; u < CONTROLLERS.length; u++) {
            var cu = CONTROLLERS[u];
            if (cu && cu.root && cu.root.isConnected && urlAn(cu.root)) { urlSchreiben(key); break; }
          }
        }
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

        /* Und jetzt laden alle NACH, die man sieht: die Ansicht dahinter und jeder offene Drawer.
           Diese Zeile steht hier und nicht in emit, und das ist der Unterschied zwischen
           "funktioniert" und "tut nichts": der Klick ruft erst applyPreset(key, true) -- mit dem
           emit darin -- und DANACH setPref/syncWeitergeben. In emit tragen die anderen Kalender
           also noch den ALTEN Zeitraum, der Vergleich mit STAND fand keinen Unterschied, und es
           passierte nichts. Gemessen: apply=1 statt 3. Hier, nach der Schleife oben, stehen sie
           auf dem neuen. */
        sichtbareBedienen(instanceId, eigenApplyVerzug());
      }
      /* Der Aufschub des EIGENEN Apply -- die anderen kommen danach, damit die Reihenfolge
         stimmt: erst der Kalender, in dem geklickt wurde. */
      function eigenApplyVerzug(){
        var v2 = parseInt(root.getAttribute("data-range-apply-delay"), 10);
        return (!isFinite(v2) || v2 < 0) ? 120 : v2;
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
          var teilbar = !!TEILBAR[committedPreset];
          var neuesPreset = teilbar ? committedPreset : DEFAULT_PRESET;

          /* KEIN RELOAD MEHR. Er war der erste Entwurf: damals kam jede Ansicht nur ueber einen
             Seitenaufbau in den richtigen Zustand. Inzwischen erledigt das anderes, und der
             Aufbau kostet auf dieser Seite neun Sekunden:

               Schalter-Optik und gesperrte Presets  der up-prefs-change-Empfaenger unten
               der Zeitraum in allen Pickern         derselbe Empfaenger, er wendet ihn jetzt an
               ?range= in der URL                    urlSchreiben(), per replaceState
               andere Ansichten auf den neuen Stand  der STAND-Vergleich beim Aktivieren, der
                                                     laedt genau die veralteten, einzeln

             setPref feuert up-prefs-change synchron, also stehen alle Picker schon richtig, bevor
             die naechste Zeile laeuft. */
          if (an) UC.setPref("date_preset", neuesPreset);
          UC.setPref("date_sync", an ? "on" : "off");
          if (urlAn(root)) urlSchreiben(an ? neuesPreset : null);

          /* Der EINZIGE Fall, der einen Ladevorgang braucht: einschalten, waehrend dieser
             Kalender auf etwas Nicht-Teilbarem stand (eigener Zeitraum oder "Letzte 6 Monate").
             Dann aendert sich der Zeitraum der Ansicht, in der der Nutzer gerade steht, und ihre
             Zahlen sind sofort falsch. applyPreset mit true ist genau der Klick-Pfad: States und
             Nachladen, eine Ansicht.
             Ausschalten aendert keinen Zeitraum -- da passiert nichts weiter, nur die Sperren
             fallen weg. */
          if (an && !teilbar) applyPreset(DEFAULT_PRESET, true);
          /* Einschalten aendert den Zeitraum jedes Pickers, der auf etwas anderem stand -- also
             laden auch hier alle nach, die man sieht. Der Schalter-Weg laeuft nicht ueber
             syncWeitergeben (die anderen ziehen ueber das prefs-Ereignis nach), darum diese
             eigene Zeile. Wessen Zeitraum sich nicht geaendert hat, wird nicht angefasst: der
             STAND-Vergleich in sichtbareBedienen entscheidet das je Picker. */
          if (an) sichtbareBedienen(instanceId, eigenApplyVerzug());
          /* EINE MELDUNG, WEIL DER SCHALTER MEHR TUT, ALS MAN SIEHT (10.09. angefordert).
             Er stellt den Zeitraum in JEDER Ansicht um -- auch in denen, die gerade nicht offen
             sind. Die sichtbaren laden nach (sichtbareBedienen oben), die anderen erst beim
             naechsten Aufruf. Wer also gleich weiterklickt, kann eine Ansicht erwischen, die
             noch die alten Zahlen zeigt; genau davor warnt der Satz.
             UC.toast ist das Preset des Hauses -- dieselbe Meldung, die "Pinned to sidebar" und
             "x prompts added" benutzen. Es meldet sich still ab, wenn die Seite kein
             showMacToast hat, wirft also nirgends. */
          try {
            if (UC.toast) UC.toast(t(an ? "Applied everywhere \u2014 refresh to update open views"
                                        : "Per view again \u2014 refresh to update open views"),
              { icon: "check", timeout: 4000 });
          } catch(e){}
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
      /* ?range= nur VOR dem Aufbau (29.09.): danach kann die Adresse hinter dem geteilten
         Zeitraum zurueckliegen, und ein Kalender, der erst mit seiner Ansicht mountet, zeigte
         den Wert vom Seitenaufbau. Nur die Anzeige -- applyPreset ohne Emit laedt nichts. */
      if (syncAn() && nimmtTeil(instanceId))
        applyPreset((!bootGetan() && urlAn(root) && urlPreset()) || syncPreset(), false);
      /* OHNE SCHALTER, aber mit URL (01.10.): der Startup der Seite hat mit ?range= geladen --
         jeder Ansicht und jedes Drawers, bei jedem Oeffnen. Dann zeigt der Kalender genau das,
         auch wenn er erst spaeter mountet. Vorher stand er dort auf "Last 7 Days" ueber Daten aus
         einem anderen Zeitraum. Ohne Schalter schreibt diese Datei die Adresse nicht mehr um, sie
         bleibt also auf dem Wert, mit dem jeder Startup laedt. */
      else if (nimmtTeil(instanceId) && urlAn(root) && urlPreset())
        applyPreset(urlPreset(), false);
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
        /* Und den geteilten Zeitraum UEBERNEHMEN. Vorher stellte dieser Empfaenger nur Optik und
           Sperren nach -- die Beschriftung zog ein anderer Picker per setPreset nach, was nur die
           Picker erreichte, die es zu diesem Zeitpunkt schon gab. Jetzt zieht sich jeder Picker
           selbst nach, sobald sich date_sync oder date_preset aendert: der eine Weg fuer den
           Schalter, fuer einen Preset-Klick in einer anderen Ansicht und fuer einen zweiten Tab.
           Still (kein Emit): die Daten dieser Ansicht holt der STAND-Vergleich beim Aktivieren
           nach, und ein Emit hier waere ein Ladevorgang je Picker. */
        if (syncAn() && nimmtTeil(instanceId)) {
          var soll = syncPreset();
          if (committedPreset !== soll) applyPreset(soll, false);
        }
      });

      var ctrl = {
        root: root,
        instanceId: instanceId,
        /* External reset is SILENT by design: it realigns the picker with a date change that has
           already happened elsewhere. Emitting here would kick off a second page-wide refresh the
           user never asked for. The Reset button inside the panel does publish. */
        /* WOHIN ZURUECK? Dahin, wo ein FRISCHER MOUNT landen wuerde -- dieselbe Zeile wie beim
           Aufbau oben, absichtlich wortgleich. Bei aktivem "ueberall anwenden" ist das der
           GETEILTE Zeitraum, NICHT Last 7 Days.
           Der Fehler dahinter (16.09. gemeldet, im Prueftand nachgestellt): die Drawer-Workflows
           rufen resetUpstreemDateRangePicker('dates_v2_<drawer>') beim SCHLIESSEN. Da ist die
           Gruppe schon weg, Bubble baut das Markup einer versteckten Gruppe nicht -- also findet
           forEachInstance keinen Kalender und PARKT den Aufruf (UC.makeLate). Beim naechsten
           Oeffnen mountet der Kalender, uebernimmt richtig den geteilten Zeitraum, und dann laeuft
           der geparkte Aufruf nach und stellt ihn auf Last 7 Days. Gemessen: 1. Oeffnen
           "Last 30 Days", 2. und 3. "Last 7 Days", geteiltes Preset unveraendert last30.
           Dass es "mal so, mal so" war, hat denselben Grund: ein geparkter Aufruf verfaellt nach
           60s (LATE_TTL_MS), wer also lange genug wartet, sieht den richtigen Zeitraum.
           Nicht die Parkerei abgeschafft: ein Reset, der vor seinem Kalender eintrifft, soll ihn
           weiter erreichen. Nur das ZIEL war falsch -- ein Reset auf Last 7 Days waere bei
           aktivem Schalter ein Zustand, in dem der Schalter luegt, genau wie beim Reset-Knopf
           im Fach (der stellt deshalb den geteilten Zeitraum mit um). */
        reset: function () {
          var ziel = (syncAn() && nimmtTeil(instanceId))
            ? ((!bootGetan() && urlAn(root) && urlPreset()) || syncPreset())
            : DEFAULT_PRESET;
          return applyPreset(ziel, false);
        },
        setPreset: function (key, emitToo) { return applyPreset(key, emitToo === true); },
        setTheme: function (t) {
          var dark = String(t || "").toLowerCase() === "dark";
          if (dark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
        },
        getRange: function () { return { from: iso(committed.from), to: iso(committed.to), preset: committedPreset }; },
        /* Der Zeitraum, mit dem Bubble laedt, wenn ihm nie jemand einen gegeben hat: die Vorgabe
           der Seite, Last 7 Days -- derselbe Start wie jeder Kalender (DEFAULT_PRESET). Als
           Signatur wie sigVon, damit STAND ihn vergleichen kann. */
        vorgabeSig: function () {
          var r = presetRange(DEFAULT_PRESET);
          return iso(r.from) + "|" + iso(r.to) + "|" + DEFAULT_PRESET;
        },
        /* Feuert den aktuellen Stand, ohne ihn zu aendern -- fuer upstreemDatesActivate und die
           Uebergabe beim Aufbau. Der Grund geht mit, damit kein seitenweiter Workflow anspringt. */
        emitCurrent: function (grund) { return emit(committed.from, committed.to, grund || "activate"); },
        /* Nur die States, nur ueber den Boot-Kanal -- nie ein Ladevorgang. */
        nurStates: function (grund) { return emit(committed.from, committed.to, grund === "boot" ? "boot" : "activate"); },
        /* Nur die States, ueber den RANGE-Kanal -- fuer eine Ansicht ohne Boot-Element. Der
           Range-Workflow setzt die States und ruft am Ende per Snippet das Apply; dieses Apply
           traegt data-range-json, also genau j3, und applyFangen laesst es ins Leere laufen.
           data-range-apply steht auf "no": ein Snippet, das darauf prueft, ruft es gar nicht erst. */
        statesUeberRange: function () {
          var p3 = {
            instance_id: instanceId,
            date_from: iso(committed.from), date_to: iso(committed.to),
            preset: committedPreset || "", reason: "activate",
            event_id: instanceId + "_" + Date.now() + "_states"
          };
          var j3 = JSON.stringify(p3);
          root.setAttribute("data-range-json", j3);
          root.setAttribute("data-range-reason", "activate");
          root.setAttribute("data-range-apply", "no");
          var an = String(root.getAttribute("data-range-apply-fn") || "").trim();
          if (an) { applyFangen(an); APPLY_SPERRE[an] = j3; }
          return callFn("data-range-fn", "bubble_fn_udr_date_range", j3);
        },
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
          var sigN = p2.date_from + "|" + p2.date_to + "|" + p2.preset;
          /* Der saubere Weg: der eigene Nachlade-Kanal -- aber das Apply laedt mit den States,
             die DA SIND (29.09.). Gemessen im Nachbau: eine Ansicht lud ueber den Apply-Kanal mit
             dem Zeitraum vom Seitenaufbau, weil ihr den neuen nie jemand gegeben hatte. Also
             erst die States ueber den Boot-Kanal (nur wenn Bubble sie noch nicht hat), dann das
             Apply. Ohne Boot-Kanal der Range-Kanal unten, der beides in einem Workflow tut. */
          /* UND DANN ERST DAS APPLY, mit demselben Aufschub wie nach einem Klick (30.09.). States
             und Apply sind zwei Bubble-Workflows, und Bubble arbeitet sie nicht zwingend in der
             Reihenfolge des Aufrufs ab -- genau dafuer gibt es data-range-apply-delay am Klickweg.
             Hier fehlte er: das Apply konnte die alten States lesen. Hat Bubble den Zeitraum
             schon (GEGEBEN), gibt es nichts abzuwarten. */
          if (root.getAttribute("data-range-apply-fn")) {
            var schonGegeben = GEGEBEN[instanceId] === sigN;
            if (schonGegeben || emit(committed.from, committed.to, "activate")) {
              var vzN = parseInt(root.getAttribute("data-range-apply-delay"), 10);
              if (!isFinite(vzN) || vzN < 0) vzN = 120;
              /* Schon gegeben heisst nicht schon geschrieben: ging die Uebergabe eben erst raus,
                 den Rest des Aufschubs abwarten. */
              var warten = schonGegeben ? restWarten(instanceId, vzN) : vzN;
              if (!schonGegeben) gegebenMerken(instanceId, sigN);
              if (!warten) return callFn("data-range-apply-fn", null, j2);
              setTimeout(function () { callFn("data-range-apply-fn", null, j2); }, warten);
              return true;
            }
          }
          gegebenMerken(instanceId, sigN);

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
      applyFangen(root.getAttribute("data-range-apply-fn"));
      /* Der Aufbau-Fall: der erste teilnehmende Kalender der Seite gibt seinen Zeitraum an
         Bubble. setTimeout(0) und nicht sofort: dieser Aufruf loest einen Bubble-Workflow aus,
         und der soll nicht mitten im Mounten dieses Elements laufen.
         Die Abfrage steht VOR dem setTimeout, nicht nur darin: sonst legen zehn Picker zehn
         Timer, von denen neun sofort wieder aussteigen. Einer reicht. */
      /* Genau EINE Warteschleife fuer die Seite. Vorher startete jeder teilnehmende Picker eine
         eigene -- bei fuenf Ansichten fuenf Schleifen, und im Log der echten Seite entsprechend
         fuenf Bloecke pro Runde. */
      /* Hat die Ansicht (oder der Drawer) dieses Kalenders schon geladen, bevor er stand? Dann
         weiss nur er, mit welchem Zeitraum sie haette laden sollen -- nachMount vergleicht und
         korrigiert einmal. VOR der Aufbau-Uebergabe eingeplant: die setzt GEGEBEN, und nachMount
         muss den Stand davor sehen. */
      setTimeout(function(){ nachMount(ctrl); }, 0);
      if (!aufbauLaeuft && !bootGetan() && istStartkandidat(instanceId)){
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
  /* ---- DER ZEITRAUM FUER EINE ANSICHT, DIE GLEICH LAEDT (02.10.) ---------------------------
     Gemeldet: Seitenaufbau im Agentic-Dashboard mit Apply to all und 3 Monaten, dann auf
     Analytic -- der Kalender steht auf 3 Monaten, die Daten sind 7 Tage. Der Kalender sitzt in
     der Analytic-Gruppe, und die ist im Agentic-Modus in Bubble versteckt: sein Boot-Element
     gibt es dann nicht, niemand kann ihm den Zeitraum geben. Der dphMode-Workflow blendet die
     Gruppe ein und laedt im NAECHSTEN Schritt -- mit den States, die der Kalender zu dem
     Zeitpunkt hat. Sein Boot-Kanal entsteht erst beim Zeichnen der Gruppe, zu spaet.
     Der Kalender kann dieses Rennen nicht gewinnen, er existiert vorher nicht. Also traegt das
     Ereignis, das den Wechsel ausloest, den Zeitraum selbst (dashboard-page-header, dphMode),
     und der Workflow setzt ihn VOR seinem RPC. Ein Lauf, richtig -- kein Nachladen.
     Dieselbe Rechnung wie vorabGeben (geltendesPreset, rangeFuerPreset), damit der Kalender
     beim Mounten dieselbe Signatur sieht. Ohne Schalter der Zeitraum des Kalenders dieser
     Ansicht, wenn er schon steht; sonst null -- dann bleibt es bei dem, was Bubble hat.
     Gibt NUR Auskunft und vermerkt nichts als uebergeben: ob Bubble den Wert nutzt, weiss diese
     Datei nicht, und ein falscher Vermerk nahme dem naechsten Besuch die Korrektur. */
  window.upstreemDatesFuerAnsicht = function (name) {
    var r = null;
    try {
      if (syncAn()) r = rangeFuerPreset(geltendesPreset());
      else {
        var c = pickerFuer(name), g = c && typeof c.getRange === "function" ? c.getRange() : null;
        if (g && g.from && g.to) r = g;
      }
    } catch (e) { r = null; }
    return r ? { date_from: r.from, date_to: r.to, preset: r.preset || "" } : null;
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
      if (c && c.instanceId && c.root && c.root.isConnected && !lokal(c.instanceId)) da.push(c);
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
  /* uebergeben() ist RAUS (29.09.). Es gab bei jedem Ansichtswechsel die States und fiel ohne
     Boot-Kanal auf den Range-Kanal zurueck. Beides macht jetzt zustandGeben: nur der Boot-Kanal,
     und nur wenn Bubble diesen Zeitraum noch nicht hat (GEGEBEN, unten). Der Fall vom 04.09.
     ("man wechselt State, dann View, und der date range state dort wird nicht geupdated") ist
     damit weiter abgedeckt: die States bekommt jede Ansicht vor ihrem view_first. */
  /* Mit WELCHEM Zeitraum sind die Daten einer Ansicht geladen? Der gemeldete Fall (03.09.):
     Dashboard mit last30 aufgebaut, in Citations auf last3 gewechselt, zurueck zum Dashboard --
     Kalender und URL stehen auf last3, die Zahlen im Dashboard sind aber noch die von last30.
     Die States stimmen (die Uebergabe setzt sie), es fehlt allein der Ladevorgang: State-Setzen
     laedt nichts nach, und das ist Absicht -- sonst haetten wir den doppelten Durchlauf zurueck.
     Also wird mitgeschrieben, mit welchem Zeitraum jede Ansicht zuletzt bedient wurde. Weicht er
     beim Aktivieren ab, wird EINMAL nachgeladen, und zwar nur diese Ansicht. Eine Alternative
     waere, bei jeder Aenderung die ganze Seite neu zu laden -- der Aufbau kostet dort 9 Sekunden,
     also nein. */
  /* Am Fenster, nicht im Modul (29.09.): date-range.js laeuft auf der echten Seite zweimal (zwei
     Einbindungen), und beide Laeufe muessen dieselbe Antwort geben -- sonst haelt der eine eine
     Ansicht fuer veraltet, die der andere gerade bedient hat. */
  var STAND = window.__udrStand || (window.__udrStand = {});
  /* ---- WAS HAT BUBBLE SCHON? (29.09.) -----------------------------------------------------
     GEGEBEN haelt je Kalender, welchen Zeitraum Bubbles States zuletzt von hier bekommen haben.
     Jede State-Uebergabe fragt zuerst: ist es derselbe, wird nichts gerufen. Vorher ging bei
     JEDEM Ansichtswechsel eine Uebergabe raus (der Grund "activate" umging den Merker), und wo
     der Boot-Kanal fehlte, fiel sie auf den Range-Kanal zurueck -- an dem der Nachlade-Workflow
     haengt. Zusammen: ein Ladevorgang je Umschalten, zusaetzlich zu view_first. */
  var GEGEBEN = window.__udrGegeben || (window.__udrGegeben = {});
  /* WANN Bubble den Zeitraum bekommen hat. "Gegeben" heisst: der Aufruf ist raus -- nicht, dass
     Bubbles Workflow die States schon geschrieben hat. Wer gleich danach laedt, wartet den Rest
     des Aufschubs ab (restWarten). Im Nachbau gemessen: die Korrektur beim Aufbau lud sonst mit
     den alten States, weil die Aufbau-Uebergabe Millisekunden vorher rausgegangen war. */
  var GEGEBEN_T = window.__udrGegebenT || (window.__udrGegebenT = {});
  function gegebenMerken(id, sig){ GEGEBEN[id] = sig; GEGEBEN_T[id] = Date.now(); }
  function restWarten(id, verzug){
    var t = GEGEBEN_T[id];
    return t ? Math.max(0, verzug - (Date.now() - t)) : 0;
  }
  /* ---- STAND IST EINE MESSUNG, KEIN WUNSCH (30.09.) ----------------------------------------
     Gemeldet: "nach ein paar Stunden oder Tagen wieder auf der Seite -- der Kalender zeigt last 3
     months, angewendet wird es nirgends" und "nach einem Wechsel bekommen neue Ansichten und
     Drawer den Zeitraum nicht, nur schon besuchte". Im Nachbau udr31 beides mit HEAD
     nachgestellt. Drei Dinge zusammen:
       1. Vor view_first wurde nur uebergeben, wenn der Kalender der Ansicht schon gemountet war.
          Bubble baut ihn aber erst beim ersten Oeffnen, und das Kopfskript ruft view_first,
          sobald die Funktion steht -- oft vorher. Dann lud die Ansicht mit der Vorgabe.
       2. Wurde uebergeben, lief view_first in derselben Millisekunde. States und Laden sind zwei
          Bubble-Workflows, und Bubble arbeitet sie nicht zwingend in Aufrufreihenfolge ab --
          im Nachbau las view_first die alten States.
       3. STAND wurde trotzdem auf den geteilten Zeitraum gesetzt (beim Aufbau, vor view_first,
          beim ersten Oeffnen eines Drawers). Danach galt alles als richtig geladen und wurde nie
          mehr nachgeladen, auch nicht beim naechsten Besuch.
     Die Antwort, ohne einen einzigen zusaetzlichen Ladevorgang beim ersten Oeffnen (das ist
     zweimal ausdruecklich abgelehnt worden -- siehe die Notiz zum Erstbesuch):
       zu 1  vorabGeben: fehlt der Kalender, geht der geteilte Zeitraum trotzdem raus, direkt an
             die Boot-Funktion der Ansicht (bubble_fn_udr_date_boot_<ansicht>). Die Daten
             rechnet rangeFuerPreset genau wie der Kalender.
       zu 2  view_first wartet nach einer Uebergabe den Aufschub von data-range-apply-delay ab
             (120ms, derselbe wie zwischen Klick und Apply), auch den Rest, wenn die Uebergabe
             gerade erst rausging (restWarten).
       zu 3  STAND bekommt den geteilten Zeitraum nur, wenn die Uebergabe VOR dem Laden
             rausging. Sonst steht dort, womit Bubble wirklich geladen hat (geladenOhneUns) --
             und der naechste Besuch laedt dann ueber den Weg nach, den es fuer veraltete
             Ansichten und Drawer schon gibt. Nachgeladen wird NIE beim Mounten und nie beim
             ersten Oeffnen. */
  function geladenOhneUns(c){
    if (!c) return null;
    if (GEGEBEN[c.instanceId]) return GEGEBEN[c.instanceId];
    /* Liest die Seite die URL (data-url-range="on"), hat ihr Startup mit ?range= geladen -- ein
       Drawer beim Oeffnen genauso wie eine Ansicht. Dann ist DAS der Stand, nicht die Vorgabe. */
    var u = (c.root && urlAn(c.root)) ? rangeFuerPreset(urlPreset()) : null;
    if (u) return u.from + "|" + u.to + "|" + u.preset;
    return typeof c.vorgabeSig === "function" ? c.vorgabeSig() : null;
  }
  function applyVerzug(c){
    var v = parseInt(c && c.root && c.root.getAttribute("data-range-apply-delay"), 10);
    return (isFinite(v) && v >= 0) ? v : 120;
  }
  /* Derselbe Zeitraum, den ein Kalender fuer dieses Preset haette -- dieselben Helfer, derselbe
     heutige Tag (startOfDay(new Date())) --, damit ein spaeter mountender Kalender dieselbe
     Signatur rechnet und nichts fuer veraltet haelt, was stimmt. */
  function rangeFuerPreset(key){
    if (!TEILBAR[key]) return null;
    var heute = startOfDay(new Date()), from;
    if (key === "last30") from = addDays(heute, -29);
    else if (key === "last3") from = addMonths(heute, -3);
    else from = addDays(heute, -6);
    return { from: iso(from), to: iso(heute), preset: key };
  }
  /* Uebergabe OHNE gemounteten Kalender (zu 1). Die Instanz heisst wie ueberall dates_v2_<ansicht>,
     die Boot-Funktion bubble_fn_udr_date_boot_<ansicht> -- so traegt es die echte Seite, und
     unter diesem Namen meldet diese Datei ein fehlendes Boot-Element. Gibt es sie nicht, bleibt
     es beim Laden mit dem, was Bubble hat.
     Rueckgabe: null (nichts gegeben) oder { sig, neu } -- neu heisst: eben erst raus, also warten. */
  var VORAB = window.__udrVorab || (window.__udrVorab = {});
  /* Welcher Zeitraum gilt fuer eine Uebergabe? Traegt die Adresse ?range=, der: diese Datei
     schreibt ihn nur, wenn die Seite ihn liest (data-url-range), und der Startup der Seite hat
     damit geladen. Sonst das gespeicherte Preset. Im Nachbau gemessen (01.10.): mit Adresse last30
     und gespeichertem last3 gab die Uebergabe vor view_first last3 -- also genau das Ueberschreiben
     der richtigen Startup-Werte, das der Nutzer beschrieben hat. */
  /* Gerufen wird das nur bei aktivem Schalter (vorErstlauf und vorabGeben steigen ohne ihn vorher
     aus). Und ?range= steht nur in der Adresse, wenn diese Datei ihn geschrieben hat -- das tut sie
     nur fuer eine Seite, die ihn liest (data-url-range) -- oder wenn jemand einen Link mit ihm
     oeffnet, der dann genau der Zeitraum ist, mit dem die Seite geladen hat. Eine Pruefung, ob
     die Seite die Adresse liest, geht an dieser Stelle nicht: vor view_first steht oft noch
     kein Kalender, an dem das Attribut sitzen koennte. */
  function geltendesPreset(){
    return urlPreset() || syncPreset();
  }
  function vorabGeben(name){
    var f = UC.resolveBubbleFn("bubble_fn_udr_date_boot_" + name);
    if (typeof f !== "function") return null;
    var r = rangeFuerPreset(geltendesPreset());
    if (!r) return null;
    var id = "dates_v2_" + name, sig = r.from + "|" + r.to + "|" + r.preset;
    if (GEGEBEN[id] === sig) return { sig: sig, neu: false };
    var payload = { instance_id: id, date_from: r.from, date_to: r.to, preset: r.preset,
                    reason: "activate", event_id: id + "_" + Date.now() + "_vorab" };
    try { f(JSON.stringify(payload)); } catch(e){ return null; }
    gegebenMerken(id, sig);
    VORAB[name] = sig;
    return { sig: sig, neu: true };
  }
  /* Ansichten, deren view_first lief, ohne dass wir vorher etwas geben konnten -- weder Kalender
     noch Boot-Funktion standen, oder view_first kam, bevor diese Datei geladen war. Am Fenster wie
     STAND: zwei Einbindungen dieser Datei muessen dieselbe Antwort geben. */
  var OHNE_UEBERGABE = window.__udrOhneUebergabe || (window.__udrOhneUebergabe = {});
  /* Ein Kalender ist fertig gemountet: festhalten, womit seine Ansicht bzw. sein Drawer geladen
     hat, wo das bisher niemand wusste. KEIN Nachladen hier -- das erledigt der naechste Besuch. */
  function nachMount(c){
    if (!c || !c.instanceId || !c.root || !c.root.isConnected || !nimmtTeil(c.instanceId) || lokal(c.instanceId)) return;
    if (istStartkandidat(c.instanceId)){
      var box = c.root.closest ? c.root.closest('[id^="view-"]') : null;
      var name = box ? box.id.slice(5) : "", k;
      if (!name){
        for (k in OHNE_UEBERGABE) if (c.instanceId.slice(-k.length) === k){ name = k; break; }
        for (k in VORAB) if (!name && c.instanceId.slice(-k.length) === k){ name = k; break; }
      }
      if (!name) return;
      /* Vorab gegeben (unter dates_v2_<ansicht>): heisst die echte Instanz anders, uebernimmt sie
         den Stand, statt als "nie geladen" zu gelten. */
      if (VORAB[name] && !STAND[c.instanceId]){
        STAND[c.instanceId] = VORAB[name];
        if (!GEGEBEN[c.instanceId]) GEGEBEN[c.instanceId] = VORAB[name];
      }
      if (OHNE_UEBERGABE[name]){
        delete OHNE_UEBERGABE[name];
        if (!STAND[c.instanceId]){ var s0 = geladenOhneUns(c); if (s0) STAND[c.instanceId] = s0; }
      }
      return;
    }
    /* Drawer-Kalender, erstes Mounten bei offenem Drawer: er hat ueber seinen eigenen Workflow mit
       seinen States geladen -- die ihm nie jemand gegeben hat. */
    if (STAND[c.instanceId] || !wirklichZuSehen(c.root)) return;
    var s1 = geladenOhneUns(c); if (s1) STAND[c.instanceId] = s1;
    STAND_BEI_OEFFNUNG[c.instanceId] = OEFFNUNG.n;
  }
  function bootDa(c){
    var r = c && c.root;
    return !!r && typeof UC.resolveBubbleFn(r.getAttribute("data-boot-fn") || "bubble_fn_udr_date_boot") === "function";
  }
  function zustandGeben(c, grund){
    if (!c || typeof c.nurStates !== "function") return false;
    var sig = sigVon(c);
    if (!sig) return false;
    if (GEGEBEN[c.instanceId] === sig) return true;
    var ok = c.nurStates(grund);
    if (ok){ gegebenMerken(c.instanceId, sig); UEBERGEBEN[c.instanceId] = 1; }
    return !!ok;
  }
  /* ---- EIN APPLY JE AENDERUNG (29.09.) ------------------------------------------------------
     Das Apply einer Auswahl kann auf der echten Seite zweimal kommen: vom Snippet am Ende des
     date_range-Workflows (liest data-range-json und ruft bubble_fn_udr_apply_<ansicht>) UND von
     hier, wenn data-range-apply-fn gesetzt ist -- die Vorlage setzt es. Beide tragen dasselbe
     JSON mit derselben event_id. Also wird die Funktion am Fenster umwickelt und laesst dieselbe
     Nutzlast innerhalb von vier Sekunden nur einmal durch, gleich in welcher Reihenfolge die
     zwei kommen. Eine NEUE Auswahl hat eine neue event_id und kommt immer durch. */
  var APPLY_ZULETZT = window.__udrApplyZuletzt || (window.__udrApplyZuletzt = {});
  /* Ein Apply, das NICHT laden soll: der Range-Kanal wurde nur fuer die States gerufen
     (statesUeberRange), und sein Snippet ruft danach trotzdem das Apply -- mit genau dieser
     Nutzlast. Einmal wegfangen, dann ist der Eintrag verbraucht. */
  var APPLY_SPERRE = window.__udrApplySperre || (window.__udrApplySperre = {});
  function amFensterWickeln(name, wickel){
    var d = null;
    try { d = Object.getOwnPropertyDescriptor(window, name); } catch(e){}
    if (d && d.get && d.get.__udrWickel) return;
    if (d && d.configurable === false) return;
    var gewickelt;
    function setze(f){ gewickelt = typeof f === "function" ? wickel(f) : f; }
    function hole(){ return gewickelt; }
    hole.__udrWickel = true;
    var vorher = d && ("value" in d) ? d.value : undefined;
    try { Object.defineProperty(window, name, { configurable: true, enumerable: true, get: hole, set: setze }); }
    catch(e){ return; }
    if (vorher !== undefined) setze(vorher);
    return true;
  }
  function applyFangen(name){
    name = String(name || "").trim();
    if (!name || !/^bubble_fn_/.test(name)) return;
    amFensterWickeln(name, function(original){
      return function(wert){
        var t0 = Date.now(), z = APPLY_ZULETZT[name];
        if (typeof wert === "string" && wert && APPLY_SPERRE[name] === wert) { delete APPLY_SPERRE[name]; return; }
        if (typeof wert === "string" && wert && z && z.json === wert && t0 - z.t < 4000) return;
        if (typeof wert === "string" && wert) APPLY_ZULETZT[name] = { json: wert, t: t0 };
        return original.apply(this, arguments);
      };
    });
  }
  /* ---- VIEW_FIRST IST DER LADER, DER KALENDER GIBT NUR DEN ZEITRAUM (29.09.) ---------------
     Vorschlag des Nutzers, und er stimmt: "wir haben doch diese view first events, die
     triggern daten eh neu". Eine Ansicht laedt ihre Daten in view_first_<name>; das Kopfskript
     ruft es beim ersten Oeffnen und nach resetView(name) erneut. Der Kalender muss also nur
     dafuer sorgen, dass die Datums-States der Ansicht stimmen, BEVOR ihr view_first laeuft --
     dann gibt es genau einen Ladevorgang, mit dem richtigen Zeitraum.

     Warum am view_first und nicht am Ansichtswechsel: der Wechsel (UC.onViewChange) kommt VOR
     dem Original von showView, und beim ersten Oeffnen ging die Uebergabe dort ins Leere -- die
     Bubble-Funktionen der Ansicht standen noch nicht. view_first dagegen kommt in jedem Fall,
     auch beim Seitenaufbau, und seine Geschwister im selben Reusable stehen dann.
     Der Griff: bubble_fn_view_first_<name> wird am Fenster umwickelt. Das Kopfskript ruft ueber
     window[name], der Wickel sitzt also genau dazwischen, gleich wer ruft. Setzt Bubble die
     Funktion neu (Neuaufbau beim Themenwechsel), faengt der Setter das ab. */
  var ERSTLAUF_WARTEN = 16;   /* mal 25ms: so lange darf view_first auf den Boot-Kanal warten */
  function erstlaufFangen(name){
    name = String(name || "").trim();
    if (!name || !/^[\w-]+$/.test(name)) return;
    var vorher = null;
    try { vorher = window["bubble_fn_view_first_" + name]; } catch(e){}
    var jetztGewickelt = amFensterWickeln("bubble_fn_view_first_" + name, function(original){
      return function(){
        var args = arguments, self = this;
        vorErstlauf(name, function(){ return original.apply(self, args); });
      };
    });
    /* STAND DIE FUNKTION SCHON, als diese Datei sie umwickeln wollte, und ist die Ansicht offen,
       dann hat das Kopfskript sie schon gerufen -- es ruft sie, sobald Bubble sie anlegt, und
       fragt dafuer alle 50ms nach. Die Ansicht hat also ohne uns geladen. Vermerken; die Kalender
       dieser Ansicht, die schon stehen, sofort pruefen, die anderen beim Mounten. Kommt der Ruf
       doch erst jetzt durch den Wickel, setzt vorErstlauf STAND richtig, und nachMount findet
       nichts mehr zu tun. */
    if (jetztGewickelt && typeof vorher === "function" && offeneAnsicht() === name){
      OHNE_UEBERGABE[name] = 1;
      var da = [];
      try { da = ansichtsKalender(name); } catch(e){}
      for (var i = 0; i < da.length; i++) nachMount(da[i]);
    }
  }
  function alleErstlaeufeFangen(){
    var v = document.querySelectorAll('[id^="view-"]');
    for (var i = 0; i < v.length; i++) erstlaufFangen(v[i].id.slice(5));
  }
  /* Die Kalender, die ZU dieser Ansicht gehoeren -- am DOM entschieden (sie liegen in ihrem
     Behaelter), nicht am Namen. Noch nicht eingerichtete werden hier eingerichtet: beim ersten
     Oeffnen ist das Element da, aber der Beobachter kam noch nicht dazu. */
  function ansichtsKalender(name){
    var box = document.getElementById("view-" + name), out = [];
    if (!box) return out;
    var wurzeln = box.querySelectorAll(".udr-root, [data-udr-root]");
    for (var i = 0; i < wurzeln.length; i++){
      if (!istStartkandidat(String(wurzeln[i].getAttribute("data-instance") || ""))) continue;
      var c = null;
      try { c = initRoot(wurzeln[i]); } catch(e){}
      if (c) out.push(c);
    }
    return out;
  }
  function vorErstlauf(name, weiter){
    /* view_first laeuft IMMER, genau einmal -- auch wenn beim Uebergeben etwas wirft. Ohne diesen
       Riegel haette ein Fehler hier die Ansicht nie laden lassen. */
    var gelaufen = false;
    function los(){
      if (gelaufen) return;
      gelaufen = true;
      try { weiter(); }
      catch(e){ if (window.console) console.warn("[date-range] view_first_" + name + " hat geworfen:", e); }
    }
    /* Die Kalender der Ansicht: im Behaelter, und zusaetzlich nach dem Namen -- steht der Kalender
       ausserhalb von #view-<name> (etwa in einem Seitenkopf daneben), fand der Behaelter-Test
       nichts, und es wurde nichts uebergeben. */
    var cs = [];
    try {
      cs = ansichtsKalender(name);
      var nachName = pickerFuer(name);
      if (nachName && istStartkandidat(nachName.instanceId) && cs.indexOf(nachName) < 0) cs.push(nachName);
    } catch(e){}
    /* OHNE SCHALTER gehoert der Zeitraum dem Kalender, und uebergeben wird nichts (29.09. spaet so
       entschieden). Festgehalten wird trotzdem, womit die Ansicht laedt: vorher blieb STAND hier
       leer, und wer den Schalter spaeter einschaltete, bekam diese Ansicht nie nachgeladen -- sie
       galt als "nie geladen". */
    if (!syncAn()){
      for (var i0 = 0; i0 < cs.length; i0++){ var s0 = geladenOhneUns(cs[i0]); if (s0) STAND[cs[i0].instanceId] = s0; }
      return los();
    }
    /* Der Kalender der Ansicht steht noch nicht -- Bubble baut ihn beim ersten Oeffnen, und das
       Kopfskript ruft view_first, sobald die Funktion da ist, oft vor dem Kalender. Nicht warten:
       eine Ansicht ohne Kalender waere jedesmal um die ganze Frist verzoegert. Stattdessen
       vermerken; nachMount vergleicht, sobald er steht, und korrigiert einmal, wenn noetig. */
    if (!cs.length){
      var vorab = null;
      try { vorab = vorabGeben(name); } catch(e){}
      if (!vorab){ OHNE_UEBERGABE[name] = 1; return los(); }
      delete OHNE_UEBERGABE[name];
      var warte = vorab.neu ? 120 : restWarten("dates_v2_" + name, 120);
      if (warte) setTimeout(los, warte); else los();
      return;
    }
    delete OHNE_UEBERGABE[name];
    var n = 0;
    (function versuch(){
      var verzug = 0;
      try {
        var fehlt = false, i;
        for (i = 0; i < cs.length; i++) if (!bootDa(cs[i])) fehlt = true;
        if (fehlt && n++ < ERSTLAUF_WARTEN){ setTimeout(versuch, 25); return; }
        for (i = 0; i < cs.length; i++){
          var c = cs[i], ziel = geltendesPreset();
          if (TEILBAR[ziel] && c.getRange().preset !== ziel) c.setPreset(ziel, false);
          var sg = sigVon(c);
          if (!sg) continue;
          /* Hat Bubble genau diesen Zeitraum schon, laedt die Ansicht damit -- nichts zu tun. */
          if (GEGEBEN[c.instanceId] === sg){
            STAND[c.instanceId] = sg;
            verzug = Math.max(verzug, restWarten(c.instanceId, applyVerzug(c)));
            continue;
          }
          var ok = false;
          if (bootDa(c)) ok = zustandGeben(c);
          /* OHNE BOOT-ELEMENT der Range-Kanal, aber nur fuer die States (29.09. spaet). Das Apply,
             das sein Snippet danach ruft, faengt applyFangen ab (APPLY_SPERRE) -- geladen wird in
             view_first, einmal. */
          else if (typeof c.statesUeberRange === "function" && c.statesUeberRange()){ gegebenMerken(c.instanceId, sg); ok = true; }
          if (ok){
            STAND[c.instanceId] = sg;
            verzug = Math.max(verzug, applyVerzug(c));
          } else {
            /* Kein Kanal erreicht Bubble: die Ansicht laedt mit dem, was sie hat. So festhalten --
               der naechste Besuch haelt sie dann fuer veraltet und laedt richtig nach. */
            var alt = geladenOhneUns(c);
            if (alt) STAND[c.instanceId] = alt;
          }
        }
      } catch(e){
        if (window.console) console.warn("[date-range] Zeitraum vor view_first_" + name + " nicht uebergeben:", e);
      }
      /* ERST DIE STATES, DANN DAS LADEN (30.09.). Beides sind Bubble-Workflows, und Bubble
         arbeitet sie nicht zwingend in der Reihenfolge des Aufrufs ab -- ein view_first in
         derselben Millisekunde las im Nachbau die alten States. Derselbe Aufschub wie zwischen
         Klick und Apply (data-range-apply-delay, 120ms), und nur, wenn wirklich etwas uebergeben
         wurde. */
      if (verzug) setTimeout(los, verzug); else los();
    })();
  }
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
    /* Seit dem 29.09. mit Merker: hat Bubble genau diesen Zeitraum schon, wird nichts gerufen.
       Steht der Aufruf in einem view_first, hat der Wickel davor ihn meist schon gegeben -- ein
       zweiter Boot-Aufruf ohne neue Information war genau die Sorte Doppelung, die hier weg
       soll. */
    if (!c) c = ansichtsKalender(name)[0] || null;
    if (!c || typeof c.emitCurrent !== "function") return false;
    return zustandGeben(c);
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
  /* ---- WER IST ZU SEHEN? NICHT DAS DOM FRAGEN --------------------------------------------
     Die teuerste Zeile dieser Datei war ein offsetParent-Test. Auf der echten Seite ist er fast
     ueberall wahr: die Host-App laesst besuchte Ansichten im Dokument stehen (184 Wurzeln auf
     der Prompts-Seite gemessen). EIN Zeitraumwechsel loeste damit 25 RPCs aus -- "jeden Refresh,
     alles was in der Session schonmal offen war", gemeldet am 04.09. Ein DOM-Test kann "zu"
     nicht von "steht noch da" unterscheiden.

     Die App kann es. Sie sagt es sogar zweimal:

       showView(name)                welche ANSICHT offen ist  -> UC.currentView()
       openDrawer(art, id)           welcher DRAWER aufgeht
       closeDrawer(art)              und welcher wieder zugeht

     Daraus fuehrt dieser Abschnitt die Liste der offenen Drawer. Das DOM wird nur noch fuer eine
     einzige Frage benutzt, und nur bei einem Drawer-Kalender: welcher von ihnen gehoert zu dem
     Drawer, der gerade aufgegangen ist (siehe drawerKalender). */
  /* Die offene Ansicht nach dem Kopfskript: es setzt view-on an genau eine. Beim Seitenaufbau ist
     das die einzige Auskunft -- showView lief noch nicht, und die Startansicht steht nicht in der
     Adresse (das Skript loescht ?view= fuer die Vorgabe). */
  function offeneAnsicht(){
    var el = document.querySelector('[id^="view-"].view-on');
    return el ? el.id.slice(5) : "";
  }
  function sichtbarImFenster(el){
    if (!el || el.offsetParent === null) return false;
    /* Eine GEPARKTE Ansicht liegt im Fenster -- das Kopfskript schiebt sie mit position: fixed
       auf 0,0 und macht sie nur durchsichtig. Der Flaechentest hielt sie deshalb fuer sichtbar,
       und eine Aenderung im Dashboard lud Citations und Prompts unsichtbar mit, mit dem Zeitraum
       vom Seitenaufbau (im Nachbau gemessen, 29.09.). Die offene Ansicht traegt view-on. */
    if (el.closest && el.closest('[id^="view-"]:not(.view-on)')) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var h = window.innerHeight || 0, w = window.innerWidth || 0;
    return r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
  }

  /* ---- DIE DRAWER ---------------------------------------------------------------------------
     Ein Drawer ist keine Ansicht -- er laeuft nicht ueber showView, es gab also keinen Moment,
     an dem "veraltet -> einmal nachladen" haengen konnte. openDrawer ist dieser Moment.

     KEIN Beobachter und KEIN Takt. Der erste Entwurf hing an einem IntersectionObserver -- die
     falsche Bauart fuer diese App, und ausserdem nicht messbar: in einer Flaeche, die keine
     Bilder rechnet, feuert er nie (gemessen: innerHeight 0, null Aufrufe).

     WELCHER Kalender zu welchem Drawer gehoert, wird zuerst am NAMEN entschieden: openDrawer
     ("domain") und die Instanz dates_v2_domainspotlight teilen das Wort. Findet das nichts (etwa
     "brand" gegen ein anders benanntes Spotlight), zaehlt, wer eine Flaeche im Fenster hat -- bei
     einem Overlay ist das belastbar, anders als bei einer weggeschalteten Ansicht. Trifft es
     einen zu viel, ist der Schaden gedeckelt: geladen wird nur, was wirklich einen anderen
     Zeitraum hat, und je Instanz hoechstens einmal.

     ZWEI Blicke, 300ms und 900ms: Bubble blendet den Drawer nach eigenem Zeitplan ein
     (Animation), ein einziger Zeitpunkt waere geraten. Beim zweiten Blick steht der Stand schon,
     die Wiederholung kann also nicht doppelt laden.

     MEHRERE DRAWER UEBEREINANDER sind kein Sonderfall: jeder hat seine eigene Instanz und seine
     eigenen States, jeder wird einzeln geprueft.

     ERSTES Oeffnen heisst NICHT nachladen: dann laedt der Drawer ueber seinen eigenen Workflow,
     und ein zweiter Aufruf waere der doppelte Durchlauf. Festgehalten wird nur, mit welchem
     Zeitraum. */
  var OFFENE_DRAWER = {};            /* art -> [instanceId, ...] */
  /* Jedes Oeffnen hat eine Nummer. Der Stand "so hat er beim ersten Oeffnen geladen" gehoert zu
     GENAU dieser Oeffnung -- die zwei Blicke (300/900ms) und das Mounten dazwischen sind dasselbe
     Oeffnen. Ohne die Nummer hielt der zweite Blick den eben festgehaltenen Stand fuer veraltet
     und lud nach: im Nachbau ein zweiter Ladevorgang beim ERSTEN Oeffnen, genau der, der nicht
     sein darf. */
  var OEFFNUNG = { n: 0 };
  var STAND_BEI_OEFFNUNG = window.__udrStandBeiOeffnung || (window.__udrStandBeiOeffnung = {});
  function drawerKalender(art){
    var wort = String(art || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    var nachName = [], mitFlaeche = [];
    for (var i = 0; i < CONTROLLERS.length; i++){
      var c = CONTROLLERS[i];
      if (!c || !c.root || !c.root.isConnected || !c.instanceId) continue;
      if (!nimmtTeil(c.instanceId) || istStartkandidat(c.instanceId) || lokal(c.instanceId)) continue;
      if (wort && c.instanceId.toLowerCase().indexOf(wort) >= 0) nachName.push(c);
      /* wirklichZuSehen und nicht nur im Fenster: ein geschlossener Drawer, der nur durchsichtig
         ist, liegt im Fenster -- und der Einstellungs-Drawer (ohne Kalender) nahm sonst den des
         Brand-Drawers als seinen und lud ihn bei jeder Aenderung unsichtbar mit (udr31, s=4). */
      else if (wirklichZuSehen(c.root)) mitFlaeche.push(c);
    }
    return nachName.length ? nachName : mitFlaeche;
  }
  function drawerBedienen(art, nr){
    var liste = drawerKalender(art), ids = [];
    var tor = DRAWER_TOR[String(art || "")];
    for (var i = 0; i < liste.length; i++){
      var c = liste[i], sig = sigVon(c);
      if (!sig) continue;
      ids.push(c.instanceId);
      /* DIESE Oeffnung ist durch das Tor gegangen (drawerTor, unten): der Drawer-Workflow lief
         erst, nachdem sein Boot-Kanal genau diesen Zeitraum hatte. Also ist er damit geladen --
         kein Nachladen, auch nicht beim zweiten Blick. */
      if (tor && tor.nr === nr && tor.sig === sig){
        STAND[c.instanceId] = sig; STAND_BEI_OEFFNUNG[c.instanceId] = nr;
        if (!GEGEBEN[c.instanceId]) gegebenMerken(c.instanceId, sig);
        continue;
      }
      var alt = STAND[c.instanceId];
      /* ERSTES OEFFNEN (30.09. korrigiert): der Drawer hat ueber seinen eigenen Workflow mit dem
         geladen, was seine States hatten -- gegeben hat sie ihm hier nie jemand, also die
         Vorgabe. Vorher stand an dieser Stelle STAND = der geteilte Zeitraum, und der Drawer galt
         fuer immer als richtig geladen: im Nachbau lud er bei JEDEM Oeffnen mit der Vorgabe,
         waehrend sein Kalender last3 zeigte. Jetzt wird festgehalten, womit er wirklich geladen
         hat. Nachgeladen wird beim ersten Oeffnen weiter nicht (das waere der doppelte Lauf) --
         beim zweiten Oeffnen greift der Weg darunter. */
      if (!alt){ var gl = geladenOhneUns(c); if (gl) STAND[c.instanceId] = gl; STAND_BEI_OEFFNUNG[c.instanceId] = nr; continue; }
      if (STAND_BEI_OEFFNUNG[c.instanceId] === nr) continue;   /* dasselbe Oeffnen */
      if (alt === sig) continue;                      /* unveraendert */
      if (!syncAn()) { STAND[c.instanceId] = sig; continue; }   /* ohne Schalter gehoert der Zeitraum ihm */
      STAND[c.instanceId] = sig;
      if (typeof c.nachladen === "function") c.nachladen();
    }
    if (ids.length) OFFENE_DRAWER[String(art || "")] = ids;
  }
  /* Einmal je Seite, wie der Ansichtswechsel: zwei Einbindungen dieser Datei haetten jeden
     veralteten Drawer zweimal nachgeladen. */
  var drawerErster = !window.__udrDrawerAngemeldet;
  window.__udrDrawerAngemeldet = true;
  if (UC.onDrawerOpen && drawerErster) UC.onDrawerOpen(function(art){
    var nr = ++OEFFNUNG.n;
    /* core meldet das Oeffnen VOR dem Original von openDrawer -- der Wickel sitzt also, bevor die
       Host-App bubble_fn_drawer_<art> ruft. */
    /* Die Momentaufnahme "was war schon zu sehen" HIER, vor dem Original: die Host-App zeigt den
       Drawer, BEVOR sie bubble_fn_drawer_<art> ruft. Im Tor genommen, stand sein Kalender schon
       in der Aufnahme und galt nie als neu (01.10., zweite Meldung zum Brand-Drawer). */
    try { VORHER_OEFFNUNG[String(art || "")] = drawerWurzelnSichtbar(); } catch(e){}
    try { LETZTE_OEFFNUNG[String(art || "")] = nr; drawerTorWickeln(art); } catch(e){}
    setTimeout(function(){ drawerBedienen(art, nr); }, 300);
    setTimeout(function(){ drawerBedienen(art, nr); }, 900);
  });
  /* Zu heisst RAUS aus der Liste. Ohne diese Zeile bliebe der Drawer fuer immer "offen" und
     wuerde bei jeder Aenderung mitbedient -- unsichtbar, also ein Ladevorgang fuer nichts. */
  if (UC.onDrawerClose && drawerErster) UC.onDrawerClose(function(art){
    delete OFFENE_DRAWER[String(art || "")];
  });

  /* ---- DER DRAWER WARTET AUF SEINEN ZEITRAUM (01.10.) ---------------------------------------
     Gemeldet, nicht zum ersten Mal: "Seite mit last 30 days laden, Kalender auf last 3 months,
     Domain-Drawer oeffnen -- sein Kalender zeigt last 3 months, die Daten kommen fuer last 7 days.
     Und nicht mal die 30 Tage vom Start klappen."
     Genau so war es gebaut. Ein Drawer laedt ueber seinen EIGENEN Workflow -- die Host-App ruft beim
     Oeffnen bubble_fn_drawer_<art> --, und der liest die States seines Kalender-Reusables. Die hatte
     ihm nie jemand gegeben, also stand dort die Vorgabe (7 Tage). drawerBedienen oben hielt das nur
     fest und lud erst beim ZWEITEN Oeffnen nach.
     Jetzt dieselbe Machart wie vor view_first (vorErstlauf): bubble_fn_drawer_<art> wird am Fenster
     umwickelt, und der Ruf der Host-App wartet, bis der geteilte Zeitraum ueber den Boot-Kanal des
     Drawers raus ist (bubble_fn_udr_date_boot_<art>, nur States), plus 120ms -- Bubble arbeitet
     zwei Workflows nicht in Aufrufreihenfolge ab. Danach laeuft der Drawer-Workflow wie immer,
     EINMAL, und liest die richtigen States. Hat der Boot-Kanal den Zeitraum schon (GEGEBEN), geht
     der Ruf sofort durch.
     Der Boot-Kanal steht womoeglich erst, wenn der Drawer aufgeht -- Bubble baut das Reusable dann.
     Darum wird bis zu 700ms auf ihn gewartet. Kommt er nicht, laeuft der Workflow trotzdem, mit
     einer Zeile in der Konsole, die den erwarteten Namen nennt: dann fehlt Bubble-seitig etwas.
     NUR MIT SCHALTER: ohne "Apply to all" gehoert der Zeitraum dem Kalender des Drawers.
     Was passiert ist, steht in window.upstreemDatesDrawerSpur() -- die Antwort auf "warum hat der
     Drawer mit 7 Tagen geladen", ohne Raten. */
  var DRAWER_TOR = window.__udrDrawerTor || (window.__udrDrawerTor = {});
  var LETZTE_OEFFNUNG = window.__udrLetzteOeffnung || (window.__udrLetzteOeffnung = {});
  var VORHER_OEFFNUNG = window.__udrVorherOeffnung || (window.__udrVorherOeffnung = {});
  var DRAWER_SPUR = window.__udrDrawerSpur || (window.__udrDrawerSpur = []);
  var DRAWER_WARTEN = 28;          /* mal 25ms: so lange darf der Drawer auf seinen Boot-Kanal warten */
  var DRAWER_GEKLAGT = {};
  function spur(art, was){
    DRAWER_SPUR.push(new Date().toISOString().slice(11, 23) + "  " + art + ": " + was);
    if (DRAWER_SPUR.length > 60) DRAWER_SPUR.shift();
  }
  window.upstreemDatesDrawerSpur = function(){ return DRAWER_SPUR.slice(); };
  function wortVon(t){ return String(t || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  /* GELERNT, NICHT GERATEN (01.10., zweite Runde). Die Namen sind nicht immer verwandt: der Drawer
     heisst in openDrawer "brand", sein Kalender dates_v2_company_spotlight, der Boot-Kanal also
     bubble_fn_udr_date_boot_company_spotlight -- kein "brand" darin, und die Namenssuche ging leer
     aus (gemeldet mit der Spur: "brand: OHNE Zeitraum, kein Boot-Kanal", waehrend der Kanal auf
     der Seite stand). Darum ein zweiter Weg: der Kalender, der MIT dem Drawer sichtbar wird, ist
     seiner (drawerWurzelNeu). Einmal gefunden, wird die Zuordnung gemerkt -- am Fenster und im
     localStorage --, und jedes weitere Oeffnen findet den Kanal sofort.
     Ebenso gemerkt: ein Drawer ohne Kalender (etwa die Einstellungen). Er wartet dann nicht bei
     jedem Oeffnen 700ms, sondern nur beim allerersten; danach geht sein Ruf gleich durch. */
  /* "_2" seit 64bde34+: die Fassung davor nahm ihre Aufnahme zu spaet und hat dabei fuer Drawer
     MIT Kalender "kein Kalender" gelernt (brand -> ""). Ein neuer Schluessel laesst diese falschen
     Eintraege liegen, statt sie weiter gelten zu lassen. */
  var LERN_SCHLUESSEL = "udr_drawer_kanal_2";
  var DRAWER_KANAL = window.__udrDrawerKanal || (window.__udrDrawerKanal = (function(){
    try { var o = JSON.parse(localStorage.getItem(LERN_SCHLUESSEL) || "{}"); return (o && typeof o === "object") ? o : {}; }
    catch(e){ return {}; }
  })());
  function kanalMerken(art, name){
    if (!art || DRAWER_KANAL[art] === name) return;
    DRAWER_KANAL[art] = name;
    try { localStorage.setItem(LERN_SCHLUESSEL, JSON.stringify(DRAWER_KANAL)); } catch(e){}
  }
  /* Der Boot-Kanal einer Kalenderwurzel: ihr data-boot-fn, sonst aus der Instanz abgeleitet
     (dates_v2_<name> -> bubble_fn_udr_date_boot_<name>) -- Drawer-Kalender tragen meist kein
     data-boot-fn, ihr Boot-Element heisst aber nach derselben Endung. */
  function bootVonWurzel(w){
    var id = String((w && w.getAttribute("data-instance")) || "").trim();
    var n = (w && w.getAttribute("data-boot-fn")) || "", f = n ? UC.resolveBubbleFn(n) : null;
    if (typeof f !== "function" && /^dates_v2_/.test(id)){
      n = "bubble_fn_udr_date_boot_" + id.slice(9);
      f = UC.resolveBubbleFn(n);
    }
    return typeof f === "function" ? { f: f, name: n, id: id } : null;
  }
  /* Kalender, die zu einem Drawer gehoeren koennen und gerade zu sehen sind: kein Export, keiner
     einer Ansicht (weder dem Namen noch dem Behaelter nach).
     "Zu sehen" heisst hier STRENGER als sichtbarImFenster: auch kein durchsichtiger oder
     verborgener Vorfahr. Ein geschlossener Drawer kann im Fenster liegen und nur ausgeblendet sein
     (opacity 0, visibility hidden) -- dann stand sein Kalender schon VOR dem Oeffnen in der Liste,
     galt nicht als neu, und der Brand-Drawer fand ihn nie (01.10., zweite Meldung). */
  function wirklichZuSehen(el){
    if (!sichtbarImFenster(el)) return false;
    for (var x = el, k = 0; x && x.nodeType === 1 && k < 40; x = x.parentElement, k++){
      var cs = getComputedStyle(x);
      if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.05) return false;
    }
    return true;
  }
  function drawerWurzelnSichtbar(){
    return [].filter.call(document.querySelectorAll(".udr-root, [data-udr-root]"), function(w){
      var id = String(w.getAttribute("data-instance") || "");
      if (!nimmtTeil(id) || istStartkandidat(id) || lokal(id)) return false;
      if (w.closest && w.closest('[id^="view-"]')) return false;
      return wirklichZuSehen(w);
    });
  }
  function drawerWurzelNeu(vorher){
    var jetzt = drawerWurzelnSichtbar();
    for (var i = 0; i < jetzt.length; i++){
      if (vorher && vorher.indexOf(jetzt[i]) >= 0) continue;
      var b = bootVonWurzel(jetzt[i]);
      if (b) return b;
    }
    return null;
  }
  /* Der Boot-Kanal DIESES Drawers. Zuerst ueber einen schon stehenden Kalender des Drawers (sein
     data-boot-fn), dann ueber den Namen bubble_fn_udr_date_boot_<art>, dann ueber alle Boot-
     Funktionen am Fenster, deren Endung den Drawer nennt. Nie die einer ANSICHT: ein Drawer
     "domain" und eine Ansicht "domains" teilen sich den Wortstamm, und dann bekaeme die Ansicht
     die States, die dem Drawer gehoeren. */
  function drawerBoot(art, vorher){
    var wort = wortVon(art), i, c, n, f;
    if (!wort) return null;
    for (i = 0; i < CONTROLLERS.length; i++){
      c = CONTROLLERS[i];
      if (!c || !c.root || !c.root.isConnected || !c.instanceId || istStartkandidat(c.instanceId) || lokal(c.instanceId)) continue;
      if (c.instanceId.toLowerCase().indexOf(wort) < 0) continue;
      n = c.root.getAttribute("data-boot-fn") || "";
      f = n ? UC.resolveBubbleFn(n) : null;
      if (typeof f === "function") return { f: f, name: n, id: c.instanceId };
    }
    n = "bubble_fn_udr_date_boot_" + art;
    f = UC.resolveBubbleFn(n);
    if (typeof f === "function") return { f: f, name: n, id: "dates_v2_" + art };
    var namen = [];
    try { namen = Object.keys(window); } catch(e){}
    var P = "bubble_fn_udr_date_boot_", treffer = null;
    for (i = 0; i < namen.length; i++){
      if (namen[i].indexOf(P) !== 0) continue;
      var rest = namen[i].slice(P.length), rw = wortVon(rest);
      if (!rw || rw.indexOf(wort) < 0) continue;
      if (document.getElementById("view-" + rest)) continue;
      f = window[namen[i]];
      if (typeof f !== "function") continue;
      /* Die kuerzeste Endung gewinnt: "domain" vor "domainspotlightbar". */
      if (!treffer || rest.length < treffer.rest.length) treffer = { f: f, name: namen[i], id: "dates_v2_" + rest, rest: rest };
    }
    if (treffer) return treffer;
    /* Kein Name passt: erst der gelernte Kanal (drawerTor, Nachlernen), dann der Kalender, der
       seit dem Oeffnen sichtbar geworden ist. Das Gelernte steht bewusst HINTER den Namen -- ein
       passender Name ist sicherer als eine Beobachtung. */
    if (DRAWER_KANAL[art]){
      f = UC.resolveBubbleFn(DRAWER_KANAL[art]);
      if (typeof f === "function") return { f: f, name: DRAWER_KANAL[art], id: "dates_v2_" + DRAWER_KANAL[art].replace(/^bubble_fn_udr_date_boot_/, "") };
    }
    return drawerWurzelNeu(vorher);
  }
  function drawerTor(art, weiter){
    art = String(art || "");
    var gelaufen = false, t0 = Date.now(), nr = LETZTE_OEFFNUNG[art] || 0;
    /* Was VOR dem Oeffnen schon zu sehen war -- der Kalender dieses Drawers ist, was danach
       dazukommt. Aufgenommen im Oeffnen-Hook (vor dem Original); nur ohne den hier. Als Erstes,
       vor jedem Ausstieg: auch das Nachlernen in los() vergleicht damit. */
    var vorher = VORHER_OEFFNUNG[art];
    if (!vorher){ vorher = []; try { vorher = drawerWurzelnSichtbar(); } catch(e){} }
    function los(was){
      if (gelaufen) return;
      gelaufen = true;
      spur(art, "Drawer-Workflow laeuft (" + was + ", nach " + (Date.now() - t0) + "ms)");
      /* NACHLERNEN, 1,5s nach dem Oeffnen: welcher Kalender ist mit diesem Drawer sichtbar
         geworden? Den fuer das naechste Mal merken -- auch wenn er diesmal zu spaet kam. Und
         erst HIER, wenn bis dahin keiner kam, gilt der Drawer als einer ohne Kalender: ein
         einzelner verpasster Blick soll einen Drawer mit Kalender nicht fuer immer abschalten. */
      setTimeout(function(){
        try {
          /* Nur, wenn seitdem KEIN anderer Drawer aufging und dieser noch offen ist: sonst ist der
             neue Kalender womoeglich der des naechsten Drawers (im Nachbau gemessen -- "domain"
             lernte den Kalender des Brand-Drawers, der 1,2s spaeter aufging). */
          if (OEFFNUNG.n !== nr) return;
          if (UC.openDrawers && UC.openDrawers().indexOf(art) < 0) return;
          var nb = drawerWurzelNeu(vorher);
          if (nb){ if (DRAWER_KANAL[art] !== nb.name) spur(art, "gelernt: " + nb.name); kanalMerken(art, nb.name); }
          else if (!DRAWER_KANAL[art]) kanalMerken(art, "");
        } catch(e){}
      }, 1500);
      try { weiter(); }
      catch(e){ if (window.console) console.warn("[date-range] bubble_fn_drawer_" + art + " hat geworfen:", e); }
    }
    if (!syncAn()){ delete DRAWER_TOR[art]; return los("ohne Apply to all"); }
    var r = rangeFuerPreset(geltendesPreset());
    if (!r){ delete DRAWER_TOR[art]; return los("kein teilbarer Zeitraum"); }
    var sig = r.from + "|" + r.to + "|" + r.preset, n = 0;
    /* Ein Drawer, der beim letzten Mal keinen Kalender hatte, wartet nicht: einmal nachsehen, dann durch. */
    var grenze = DRAWER_KANAL[art] === "" ? 0 : DRAWER_WARTEN;
    (function versuch(){
      var b = null;
      try { b = drawerBoot(art, vorher); } catch(e){}
      if (b) kanalMerken(art, b.name);
      if (!b){
        if (n++ < grenze){ setTimeout(versuch, 25); return; }
        delete DRAWER_TOR[art];
        if (!DRAWER_GEKLAGT[art] && window.console){
          DRAWER_GEKLAGT[art] = true;
          console.warn("[date-range] Drawer \"" + art + "\": kein Boot-Kanal nach 700ms " +
            "und kein Kalender, der mit ihm sichtbar wurde. Hat dieser Drawer einen Kalender, laedt " +
            "er mit den States, die Bubble hat: sein udr_date_boot-Element muss stehen, sobald er " +
            "aufgeht. Hat er keinen, ist nichts zu tun -- das naechste Oeffnen wartet nicht mehr.");
        }
        return los("OHNE Zeitraum, kein Boot-Kanal");
      }
      DRAWER_TOR[art] = { nr: nr, sig: sig };
      if (GEGEBEN[b.id] === sig){
        var w = restWarten(b.id, 120);
        spur(art, "Boot " + b.name + " hat " + r.preset + " schon");
        if (w) setTimeout(function(){ los("Zeitraum stand schon"); }, w); else los("Zeitraum stand schon");
        return;
      }
      var payload = { instance_id: b.id, date_from: r.from, date_to: r.to, preset: r.preset,
                      reason: "activate", event_id: b.id + "_" + Date.now() + "_drawer" };
      try { b.f(JSON.stringify(payload)); }
      catch(e){ delete DRAWER_TOR[art]; return los("Boot-Kanal hat geworfen"); }
      gegebenMerken(b.id, sig);
      if (b.id !== "dates_v2_" + art) gegebenMerken("dates_v2_" + art, sig);
      spur(art, "Boot " + b.name + " <- " + r.preset + " (" + r.from + " bis " + r.to + "), nach " + (Date.now() - t0) + "ms");
      setTimeout(function(){ los("Zeitraum gegeben"); }, 120);
    })();
  }
  function drawerTorWickeln(art){
    art = String(art || "").trim();
    if (!art || !/^[\w-]+$/.test(art)) return;
    var name = "bubble_fn_drawer_" + art;
    if (amFensterWickeln(name, function(original){
      return function(){
        var args = arguments, self = this;
        spur(art, "Ruf der Host-App gehalten");
        drawerTor(art, function(){ return original.apply(self, args); });
      };
    })) spur(art, "Tor an " + name);
  }

  /* ---- EINE AENDERUNG BEDIENT ALLES, WAS MAN SIEHT ----------------------------------------
     Wer im Drawer den Zeitraum umstellt, meint die ganze Seite -- die Ansicht dahinter gehoert
     dazu, und jeder weitere offene Drawer auch. Aber NUR die: was zu ist, laedt beim naechsten
     Oeffnen (openDrawer-Weg) bzw. beim naechsten Aktivieren (Ansichtsweg).

     Die Liste der Kandidaten ist darum kurz, und sie kommt nicht aus dem DOM:

       die offene Ansicht   DREI Quellen, in dieser Reihenfolge:
                              1. UC.currentView() -- der Name des letzten showView. Das
                                 frischeste Ereignis, also zuerst.
                              2. ?view= in der Adresse. Die Antwort fuer den Seitenaufbau und
                                 fuer einen Reload/Deeplink auf eine Ansicht -- da hat showView
                                 noch nicht gefeuert.
                              3. nur wenn beides schweigt: wer eine Flaeche im Fenster hat. Das
                                 ist hier belastbar, denn ohne Ansichtswechsel gibt es keine
                                 besuchte Ansicht, die nur noch im Dokument steht.
       die offenen Drawer   OFFENE_DRAWER, gefuehrt von openDrawer/closeDrawer.

     GESTAFFELT, nicht alle in derselben Millisekunde: ein JavaScriptToBubble-Element traegt EINEN
     Wert, und Bubble startet den Workflow an der Zustandsaenderung. Zwei Aufrufe im selben Task
     koennen zu einem verschmelzen -- dann laedt einer der Kalender nicht. 150ms Abstand, und der
     erste kommt nach dem eigenen Apply, damit die Reihenfolge stimmt: erst der Kalender, in dem
     geklickt wurde, dann die anderen.

     Je Instanz-Id hoechstens EINMAL: von derselben Id gibt es auf der Seite mehrere Kopien
     (dates_v2_export 18x gemessen), und die teilen sich ihre Bubble-States. */
  function sichtbareBedienen(ausserId, abVerzug){
    if (!syncAn()) return;
    var ziele = [], gesehen = {};
    function dazu(c){
      if (!c || !c.instanceId || c.instanceId === ausserId || gesehen[c.instanceId]) return;
      if (!nimmtTeil(c.instanceId) || typeof c.nachladen !== "function") return;
      gesehen[c.instanceId] = 1;
      ziele.push(c);
    }
    var name = (UC.currentView && UC.currentView()) || offeneAnsicht() || urlAnsicht();
    if (name) dazu(pickerFuer(name));
    else {
      /* WEDER showView gerufen NOCH ?view= in der Adresse. Dann -- und nur dann -- der Blick ins
         Fenster: ohne Ansichtswechsel gibt es auch keine Spukansicht, denn eine Ansicht steht
         erst im Dokument, nachdem man sie besucht hat. Genau dieser Fall ist im Prueftand
         aufgefallen (Drawer auf, Zeitraum darin umgestellt, kein showView, keine Adresse -- die
         Hauptansicht blieb auf den alten Zahlen). */
      for (var i2 = 0; i2 < CONTROLLERS.length; i2++){
        var c2 = CONTROLLERS[i2];
        if (!c2 || !c2.root || !c2.root.isConnected) continue;
        if (!istStartkandidat(c2.instanceId)) continue;
        if (sichtbarImFenster(c2.root)) dazu(c2);
      }
    }
    for (var art in OFFENE_DRAWER){
      if (!Object.prototype.hasOwnProperty.call(OFFENE_DRAWER, art)) continue;
      var ids = OFFENE_DRAWER[art];
      for (var k2 = 0; k2 < ids.length; k2++) dazu(pickerFuer(ids[k2]));
    }
    var n = 0;
    for (var k = 0; k < ziele.length; k++){
      var z = ziele[k], sig = sigVon(z);
      if (!sig || STAND[z.instanceId] === sig) continue;  /* schon mit diesem Zeitraum bedient */
      STAND[z.instanceId] = sig;
      n++;
      (function(c2, verzug){ setTimeout(function(){
        if (c2.root && c2.root.isConnected) c2.nachladen();
      }, verzug); })(z, (abVerzug || 0) + n * 150);
    }
  }

  /* DREI MELDER, EINE REGEL: showView fuer die Ansichten (hier), openDrawer fuer die Drawer
     (darueber), und der Klick im Kalender fuer alles, was gerade offen ist (sichtbareBedienen).
     Alle drei fragen dasselbe -- "ist der Zeitraum ein anderer als der, mit dem hier zuletzt
     geladen wurde?" -- und alle drei schreiben STAND, bevor sie rufen. Ueberschneiden koennen sie
     sich nicht: die Drawer-Runde ueberspringt jeden Ansichts-Kalender, der Ansichtswechsel findet
     nur den Kalender seiner Ansicht, und wer schon bedient ist, hat denselben STAND. */
  /* ---- DIE STARTANSICHT: EINMAL, BEIM AUFBAU ----------------------------------------------
     Welche Ansicht beim Seitenaufbau offen ist, weiss der Kalender nicht: showView hat noch nicht
     gefeuert, und die Aufbau-Uebergabe macht der Kalender, der ZUERST mountet -- das ist nicht
     zwingend der sichtbare (im Prueftand gemessen: Startansicht "citations", Uebergabe von
     "dashboard"). Ihr Zeitraum muss aber festgehalten werden, sonst gilt sie beim ersten
     Zurueckkehren als "noch nie geladen" und wird NICHT nachgeladen, obwohl ihre Zahlen von
     einem anderen Zeitraum sind.

     Also EINMAL, genau hier: wer jetzt eine Flaeche im Fenster hat, ist offen. Zu diesem
     Zeitpunkt ist der DOM-Test belastbar -- die Seite hat gerade geladen, es gibt noch keine
     besuchte Ansicht, die nur noch im Dokument steht. Genau daran ist die Vorgaengerfassung
     gescheitert: sie lief beim ERSTEN ANSICHTSWECHSEL, und da war der Spuk schon da (184
     Wurzeln, fast alle "sichtbar"). Sie schrieb Ansichten ein STAND, die nie geladen hatten --
     und damit wurden sie nie nachgeladen. Gemeldet als "der date range state dort wird nicht
     geupdated". */
  function startlageFesthalten(){
    /* ERST die Adresse fragen: ?view= nennt die offene Ansicht beim Aufbau, und damit ist es
       genau EIN Kalender statt eines Suchlaufs durch alle. */
    var name = urlAnsicht(), c0 = name ? pickerFuer(name) : null;
    if (c0 && nimmtTeil(c0.instanceId) && !STAND[c0.instanceId]){
      var s0 = sigVon(c0);
      if (s0){ STAND[c0.instanceId] = s0; return; }
    }
    if (name) return;   /* Die Adresse hat geantwortet -- dann nicht zusaetzlich raten. */
    /* Ohne ?view= bleibt der Blick ins Fenster. Er ist NUR hier belastbar, beim Aufbau: eine
       besuchte Ansicht, die nur noch im Dokument steht, gibt es zu diesem Zeitpunkt nicht. */
    for (var i = 0; i < CONTROLLERS.length; i++){
      var c = CONTROLLERS[i];
      if (!c || !c.root || !c.root.isConnected || !c.instanceId) continue;
      if (!nimmtTeil(c.instanceId) || STAND[c.instanceId]) continue;
      if (!sichtbarImFenster(c.root)) continue;
      var sg = sigVon(c);
      if (sg) STAND[c.instanceId] = sg;
    }
  }
  /* ---- DER ANSICHTSWECHSEL (29.09. neu) ---------------------------------------------------
     Er entscheidet nur noch EINES: ist die Ansicht veraltet -- mit einem anderen Zeitraum geladen
     als dem, der jetzt gilt? Dann resetView(name): das Kopfskript ruft gleich darauf view_first
     erneut, und dessen Wickel (vorErstlauf) gibt vorher die States. EIN Ladevorgang, ueber den
     Weg, den die Ansicht ohnehin hat.
     Vorher lud der Kalender selbst nach (Range-Kanal, 250ms spaeter) und uebergab bei jedem
     Wechsel zusaetzlich die States. Beim ersten Oeffnen ging die Uebergabe ins Leere (die
     Bubble-Funktionen der Ansicht standen noch nicht), und die Ansicht lud mit dem Zeitraum vom
     Seitenaufbau -- gemeldet als "switcht nicht zum neuen Wert, erst beim zweiten Besuch".
     Einmal je Seite angemeldet, nicht je Einbindung: zwei Laeufe dieser Datei haetten zweimal
     nachgeladen. */
  if (UC.onViewChange && !window.__udrAnsichtAngemeldet) {
    window.__udrAnsichtAngemeldet = true;
    UC.onViewChange(function (name) {
      if (!name) return;
      erstlaufFangen(name);
      if (!syncAn() || !nimmtTeil(name)) return;
      var c = pickerFuer(name);
      if (!c || !nimmtTeil(c.instanceId)) return;   /* erster Besuch: der Wickel an view_first uebernimmt */
      var sig = sigVon(c), alt = STAND[c.instanceId];
      if (!(alt && sig && alt !== sig)) return;
      if (typeof window.resetView === "function" && bootDa(c)) {
        window.resetView(name);
        return;
      }
      /* Ohne resetView (eine andere Seite als die App) oder ohne Boot-Kanal bleibt der alte Weg:
         der Range-Kanal setzt die States UND laedt nach -- ebenfalls genau ein Ladevorgang.
         NACH dem Umschalten: eine Bubble-Gruppe, die noch nicht sichtbar ist, verwirft ihn. */
      STAND[c.instanceId] = sig;
      setTimeout(function(){
        if (c.root && c.root.isConnected) c.nachladen();
      }, 250);
    });
  }
  window.addEventListener("up-prefs-change", function (e) {
    var n = e && e.detail && e.detail.name;
    if (!n || n === "date_preset" || n === "date_sync") UEBERGEBEN = {};
  });
  window.setDateRangeTheme = function (instanceId, theme) {
      initAll();
      return forEachInstance(instanceId, function (c) { c.setTheme(theme); });
    };

    initAll();
    alleErstlaeufeFangen();
    if (UC.watchRoots) UC.watchRoots("udr-root", function(){ initAll(); alleErstlaeufeFangen(); });

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
    /* Nur noch der Boot-Kanal (29.09.): der Range-Kanal war der Rueckfall, und an ihm haengt
       der Nachlade-Workflow -- beim Aufbau also der zweite Ladevorgang neben view_first. */
    function bootKanal(root){
      var b = root.getAttribute("data-boot-fn") || "bubble_fn_udr_date_boot";
      return typeof UC.resolveBubbleFn(b) === "function" ? "boot" : null;
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
    /* DIE URL IST DIE QUELLE, sobald die Seite sie liest (01.10.). Der Nutzer hat beschrieben,
       was seine Seite tut: der Startup jeder Ansicht und JEDES Drawers setzt die Datums-States
       aus ?range=, bevor die RPCs laufen. Und dann kam diese Datei und rief udr_date_boot mit dem
       Wert des Kalenders -- ohne Schalter immer "Last 7 Days", mit Schalter das Preset aus dem
       Browser -- und ueberschrieb, was der Startup eben richtig gesetzt hatte. Genau so gemeldet:
       "wenn das nach dem Startup laeuft und die alten Daten hat, ueberschreibt es die Werte".
       Vorher wurde nur uebersprungen, wenn Schalter an UND URL gleich gespeichertem Preset. Jetzt
       reicht, dass die Seite die URL liest (data-url-range="on") und die URL einen Zeitraum traegt:
       dann hatte Bubble ihn vor der ersten Abfrage. Weicht das gespeicherte Preset ab, wird es
       der URL angeglichen -- mit ihr ist die Seite gerade geladen worden, und Anzeige, States und
       Daten muessen dasselbe sagen. */
    function urlHatIhnSchon(root){
      if (!urlAn(root)) return null;
      var u = urlPreset();
      if (!u) return null;
      if (syncAn() && u !== syncPreset()) UC.setPref("date_preset", u);
      return 'die URL trug "' + u + '" und data-url-range="on" steht am Element -- Bubble ' +
             'kannte den Zeitraum vor der ersten Abfrage';
    }
    function aufbauUebergeben(c, rest){
      if (bootGetan() || !c || !c.instanceId || !istStartkandidat(c.instanceId)) return;
      if (rest == null) rest = AUFBAU_MAX;
      if (rest === AUFBAU_MAX){
        var unnoetig = urlHatIhnSchon(c.root);
        if (unnoetig){
          bootMerken();
          /* Die Startansicht laedt gleich mit genau diesem Zeitraum -- festhalten, sonst gilt sie
             beim ersten Zurueckkehren als veraltet und wird ohne Not nachgeladen. */
          var s0 = sigVon(c); if (s0) { STAND[c.instanceId] = s0; GEGEBEN[c.instanceId] = s0; }
          startlageFesthalten();
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
        zustandGeben(c, "boot");
        /* KEIN STAND MEHR HIER (30.09.). Die States gehen jetzt raus -- ob die Startansicht damit
           geladen hat, weiss diese Stelle nicht: Bubbles Bruecke steht erst Sekunden nach dem
           Aufbau, und bis dahin kann view_first laengst mit der Vorgabe gelaufen sein. Genau das
           war "der Kalender zeigt last 3 months, angewendet wird es nirgends": hier stand
           "geladen mit last3", und die Ansicht wurde nie nachgeladen. STAND setzt jetzt, wer es
           weiss: vorErstlauf (Uebergabe vor view_first) oder nachMount (Vergleich danach). */
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
