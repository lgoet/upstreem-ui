/* upstreem export-data.js — Export-Dialog (Praefix `uex`). Braucht core.js und
   filters/date-range.js.

   ── Was sich gegenueber der Standalone-Fassung geaendert hat ─────────────────
   1. Der Kalender gehoert jetzt dieser Komponente. Vorher musste auf JEDER Seite ein zweites,
      unsichtbares date-range-Element liegen (dates_v2_export), dessen Knoten beim Oeffnen in den
      Dialog geschoben und beim Schliessen zurueckgeschoben wurde. Fehlte es, stand im Dialog
      "Date picker not found". Jetzt legt die Komponente sich ihr eigenes .udr-root an.
      filters/date-range.js wird dabei NICHT angefasst -- benutzt werden nur ihre oeffentlichen
      Wege. Die ganze bewaehrte Logik (Panelposition, Presets, Grenzen, die drei
      bubble_fn_udr_*-Workflows) bleibt unveraendert.
   2. Farben kommen aus core (--vc-*) statt aus einem eigenen --am-*-Satz. Zwei Paletten in einer
      App laufen genau so lange gleich, bis jemand eine davon anfasst.

   NICHT geaendert: Eventname und Payload-Form, upstreemExportOpen/Close/SetContext/Resolve,
   die Regex-Extraktion auf Bubble-Seite, der 90s-Sicherheitstimer. Wer die Komponente schon
   verdrahtet hat, muss nichts nachziehen ausser dem Loader. */

(function(){
  "use strict";

  var TYPES = [
    { value: "prompts",     label: "Prompts"   },
    { value: "prompt_runs", label: "Responses" },
    { value: "domains",     label: "Domains"   },
    { value: "urls",        label: "URLs"      },
    { value: "brands",      label: "Brands"    }
  ];
  /* Keys are deliberately the SAME strings the date range picker uses for its own presets,
     so syncing the two is a straight pass-through with nothing to translate. */
  var PRESETS = [
    { key: "last7",  label: "Last 7 Days",   days: 7  },
    { key: "last30", label: "Last 30 Days",  days: 30 },
    { key: "last3",  label: "Last 3 Months", months: 3 },
    { key: "last6",  label: "Last 6 Months", months: 6 }
  ];

  var CHECK_SVG = '<span class="uex-opt-check" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg></span>';

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c];
    });
  }
  function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n){ var r = startOfDay(d); r.setDate(r.getDate() + n); return r; }
  function addMonths(d, n){
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    var last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(d.getDate(), last));
    return startOfDay(t);
  }
  function isoDate(d){
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  /* UTC midnight of the given (local) calendar date, as Unix ms. Deliberately NOT d.getTime():
     that reads local midnight, which in any timezone ahead of UTC (e.g. CEST, UTC+2) lands on the
     PREVIOUS UTC calendar day — so a date picked as "23 Jul" arrived at the backend as "22 Jul,
     22:00 UTC" and was read back as the 22nd. Date.UTC() builds the timestamp straight from the
     calendar fields, sidestepping the browser's local timezone entirely. */
  function utcMidnight(d){
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function parseIso(v){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : startOfDay(d);
  }
  function prettyDate(d){
    var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return String(d.getDate()).padStart(2,"0") + ". " + M[d.getMonth()] + " " + d.getFullYear();
  }
  /* INCLUSIVE day count: "Last 7 Days" (17th…23rd) is 7, not 6. */
  function dayCount(from, to){
    return Math.abs(Math.round((startOfDay(to) - startOfDay(from)) / 86400000)) + 1;
  }
  /* Outbound event lookup: window/parent/top first, then a full BFS over every reachable
     iframe — needed when the receiving Toolbox element sits deeper than one level up. */
  function resolveBubbleFn(fnName){
    /* ZUERST die Fassung aus core. Diese Datei trug seit der Standalone-Zeit eine eigene Kopie:
       dieselbe Idee, aber ohne den Cache und ohne die Behandlung von Frames, deren Fenster
       inzwischen geschlossen ist. In der App wurde bubble_fn_upstreemExport_<id> damit nicht
       gefunden, obwohl das Element da war. Die Kopie bleibt als Rueckfall stehen, falls core
       einmal nicht geladen ist -- dann ist sie besser als nichts. */
    try {
      var uc = window.UpstreemCore;
      if (uc && typeof uc.resolveBubbleFn === "function"){
        var viaCore = uc.resolveBubbleFn(fnName);
        if (typeof viaCore === "function") return viaCore;
      }
    } catch(e){}
    var fn = window[fnName] || (window.parent && window.parent[fnName]) || (window.top && window.top[fnName]);
    if (typeof fn === "function") return fn;
    var start; try { start = window.top || window.parent || window; } catch(e){ start = window; }
    var queue = [start], seen = [];
    while (queue.length){
      var win = queue.shift();
      if (seen.indexOf(win) !== -1) continue;
      seen.push(win);
      try { if (typeof win[fnName] === "function") return win[fnName]; } catch(e){}
      var frames; try { frames = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
      for (var i = 0; i < frames.length; i++){
        var cw; try { cw = frames[i].contentWindow; } catch(e){ cw = null; }
        if (cw && seen.indexOf(cw) === -1) queue.push(cw);
      }
    }
    return null;
  }

  /* State that must survive Bubble rebuilding the element, keyed by instanceId. */
  var STORE = (window.__uexStore = window.__uexStore || {});

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};
    /* Der Knopf kommt aus der Komponente, nicht aus dem Bubble-Markup. In der Standalone-Fassung
       stand er im HTML des Elements -- damit haette jede Aenderung daran von Hand in jedes
       bestehende Element nachgezogen werden muessen (bubble/*.html ist eine Vorlage, siehe die
       anderen Komponenten). Ein vorhandener Knopf wird respektiert, wer ihn im Markup hat,
       behaelt ihn. */
    var btn = root.querySelector(".uex-btn");
    if (!btn){
      btn = document.createElement("button");
      btn.className = "uex-btn";
      btn.type = "button";
      btn.setAttribute("aria-haspopup", "dialog");
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML =
        '<svg class="uex-btn-ic" viewBox="0 0 24 24" aria-hidden="true">' +
          '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
          '<polyline points="7 10 12 15 17 10"></polyline>' +
          '<line x1="12" y1="15" x2="12" y2="3"></line>' +
        '</svg><span class="uex-btn-label">Export</span>';
      root.appendChild(btn);
    }

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    var today = startOfDay(new Date());
    var state = {
      type: normType(root.getAttribute("data-export-type")) || saved.type || TYPES[0].value,
      token: root.getAttribute("data-token") || saved.token || "",
      preset: saved.preset || "last7",
      from: parseIso(saved.from) || addDays(today, -6),
      to: parseIso(saved.to) || today,
      open: false,
      processing: false
    };

    function normType(v){
      var s = String(v == null ? "" : v).trim().toLowerCase();
      if (!s || s === "EXPORT_TYPE".toLowerCase()) return null;
      for (var i = 0; i < TYPES.length; i++) if (TYPES[i].value === s) return s;
      // tolerate a few obvious aliases so a slightly different Bubble value still lands right
      if (s === "responses" || s === "runs") return "prompt_runs";
      if (s === "url") return "urls";
      if (s === "domain") return "domains";
      if (s === "brand") return "brands";
      if (s === "prompt") return "prompts";
      return null;
    }
    function persist(){
      STORE[instanceId] = {
        type: state.type, token: state.token, preset: state.preset,
        from: isoDate(state.from), to: isoDate(state.to)
      };
    }

    /* ---------------- popup ---------------- */
    var overlay = document.createElement("div");
    /* up-root MIT dazu: das Overlay haengt an <body>, also ausserhalb jeder .up-root -- und die
       --vc-*-Tokens stehen genau dort. Ohne die Klasse erbte der Dialog nichts und fiel auf die
       Rueckfallwerte zurueck; gemessen kam er fast schwarz heraus, obwohl kein Dark Mode aktiv
       war. Dasselbe Muster wie bei notification-card, die ebenfalls an <body> baut. */
    /* Das Core-Popup, nicht ein eigenes. .up-topicmodal-backdrop bringt Schleier, Weichzeichner,
       Einblendung und den Dark-Mode mit; .up-topicmodal-card die Karte samt Palette, Radius,
       Schatten und Auftauchbewegung. Vorher stand hier ein Nachbau mit eigenen Werten -- andere
       Deckkraft, kein Blur, andere Kurve. Genau das, was der Styleguide verbietet. */
    overlay.className = "up-root up-portal up-topicmodal-backdrop uex-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.inert = true;
    overlay.innerHTML =
      '<div class="up-topicmodal-card uex-dialog" role="dialog" aria-modal="true" aria-label="Export data">' +
        '<div class="up-topicmodal-head uex-head">' +
          '<div class="up-topicmodal-heading">' +
            '<h2 class="up-topicmodal-title">Export Data</h2>' +
          '</div>' +
          /* .up-popup-close ist der Knopf JEDES Popups: kein Rahmen, Hover nur Flaeche und
             Primaerfarbe. Der eigene hatte einen Rahmen, der erst beim Ueberfahren erschien --
             der Knopf sprang und sah aus wie nirgends sonst in der App. */
          '<button class="up-popup-close uex-close" type="button" aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
              'stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>' +
          '</button>' +
        '</div>' +
        '<div class="uex-body">' +
          /* Zeitraum ZUERST. Nicht aus Gewohnheit, sondern weil der Kalender sein Panel unter
             dem Custom-Knopf oeffnet und dafuer Platz braucht: stand der Block unten, blieben
             darunter rund 290px, und der Picker wich nach oben aus und legte sich ueber den
             Dialog. Die Alternative waere gewesen, diesen einen Dialog anders zu platzieren als
             jedes andere Popup der App -- genau die Ausnahme, die der Styleguide verhindern soll.
             Die Zusammenfassung bleibt beim Zeitraum, sie nennt beides. */
          '<div class="uex-section">' +
            '<span class="uex-label">Time range</span>' +
            '<div class="uex-grid is-presets"></div>' +
            '<div class="uex-custom-wrap">' +
              '<button class="uex-opt uex-custom-btn" type="button">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                  '<rect x="3" y="4" width="18" height="17" rx="2"></rect>' +
                  '<path d="M16 2v4M8 2v4M3 10h18"></path>' +
                '</svg>' +
                '<span class="uex-opt-label uex-custom-text">Custom range</span>' +
                '<span class="uex-opt-check" aria-hidden="true">' +
                  '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
                '</span>' +
              '</button>' +
              '<div class="uex-cal-slot"></div>' +
            '</div>' +
            '<div class="uex-summary"></div>' +
          '</div>' +
          '<div class="uex-section">' +
            '<span class="uex-label">What to export</span>' +
            '<div class="uex-grid is-types"></div>' +
          '</div>' +
        '</div>' +
        '<div class="uex-foot">' +
          '<button class="uex-submit" type="button">' +
            '<span class="uex-submit-icon">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true">' +
                '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
                '<polyline points="7 10 12 15 17 10"></polyline>' +
                '<line x1="12" y1="15" x2="12" y2="3"></line>' +
              '</svg>' +
            '</span>' +
            '<span class="uex-submit-text">Export</span>' +
          '</button>' +
          '<div class="uex-secondary">' +
            '<button class="uex-cancel" type="button">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    /* Verwaiste Overlays derselben Instanz wegraeumen. Bubble baut diese Elemente staendig neu
       auf, und jeder Aufbau haengte bisher ein weiteres Overlay an <body> -- gemessen 36 Stueck
       bei 14 Elementen. Das ist nicht nur Speicher: die alten reagieren weiter auf Escape und
       auf ihre eigenen Klicks, und welches davon upstreemExportOpen erwischt, ist Zufall. */
    var alt = document.querySelectorAll('.uex-overlay[data-uex-instance="' + instanceId + '"]');
    for (var a = 0; a < alt.length; a++){
      if (alt[a].parentNode) alt[a].parentNode.removeChild(alt[a]);
    }
    overlay.setAttribute("data-uex-instance", instanceId);
    document.body.appendChild(overlay);

    var elTypes   = overlay.querySelector(".uex-grid.is-types");
    var elPresets = overlay.querySelector(".uex-grid.is-presets");
    var elCustomBtn = overlay.querySelector(".uex-custom-btn");
    var elCustomTxt = overlay.querySelector(".uex-custom-text");
    var elCustomWrap = overlay.querySelector(".uex-custom-wrap");
    var elCalSlot = overlay.querySelector(".uex-cal-slot");
    var elSummary = overlay.querySelector(".uex-summary");
    var elDialog  = overlay.querySelector(".uex-dialog");
    var elBody    = overlay.querySelector(".uex-body");
    var elClose   = overlay.querySelector(".uex-close");
    var elCancel  = overlay.querySelector(".uex-cancel");
    var elSubmit  = overlay.querySelector(".uex-submit");
    var elSubmitIcon = overlay.querySelector(".uex-submit-icon");
    var elSubmitText = overlay.querySelector(".uex-submit-text");
    var SPINNER_SVG = '<span class="uex-spin" aria-hidden="true"></span>';
    var EXPORT_SVG =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>' +
        '<polyline points="7 10 12 15 17 10"></polyline>' +
        '<line x1="12" y1="15" x2="12" y2="3"></line>' +
      '</svg>';

    function syncTheme(){
      var dark = isYes(root.getAttribute("data-isdark"));
      isDark = dark;
      if (dark){ root.setAttribute("data-theme","dark"); overlay.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); overlay.removeAttribute("data-theme"); }
    }

    function renderTypes(){
      elTypes.innerHTML = TYPES.map(function(t){
        return '<button class="uex-opt' + (t.value === state.type ? " is-active" : "") +
               '" type="button" data-type="' + esc(t.value) + '">' +
               '<span class="uex-opt-label">' + esc(t.label) + '</span>' + CHECK_SVG + '</button>';
      }).join("");
    }
    function renderPresets(){
      elPresets.innerHTML = PRESETS.map(function(p){
        return '<button class="uex-opt' + (p.key === state.preset ? " is-active" : "") +
               '" type="button" data-preset="' + esc(p.key) + '">' +
               '<span class="uex-opt-label">' + esc(p.label) + '</span>' + CHECK_SVG + '</button>';
      }).join("");
      var custom = state.preset === "custom";
      elCustomBtn.classList.toggle("is-active", custom);
      // once a custom range is picked the button shows it, so the row is never just a dead label
      elCustomTxt.textContent = custom
        ? (prettyDate(state.from) + " – " + prettyDate(state.to))
        : "Custom range";
    }
    function renderSummary(){
      var label = TYPES.filter(function(t){ return t.value === state.type; })[0];
      elSummary.innerHTML =
        "Exporting <b>" + esc(label ? label.label : state.type) + "</b> from <b>" +
        esc(prettyDate(state.from)) + "</b> to <b>" + esc(prettyDate(state.to)) +
        "</b> &mdash; <b>" + dayCount(state.from, state.to) + "</b> days.";
    }
    function renderAll(){ renderTypes(); renderPresets(); renderSummary(); }

    function applyPreset(key){
      var p = PRESETS.filter(function(x){ return x.key === key; })[0];
      if (!p) return;
      state.preset = key;
      // Drive the real picker and then adopt exactly what IT committed, rather than computing the
      // range twice in two places. That keeps the calendar showing the same thing the popup shows
      // (it used to sit at its own "Last 7 Days" no matter what was picked up here) and means any
      // clamping the picker applies — e.g. its 2024-01-01 lower bound — is honoured automatically.
      // Silent on purpose: syncing the display must not fire the picker's Bubble workflows.
      var synced = syncCalendarToPreset(key);
      if (!synced){
        var t = startOfDay(new Date());
        state.to = t;
        state.from = p.days ? addDays(t, -(p.days - 1)) : addMonths(t, -p.months);
      }
      persist(); renderAll();
    }
    /* Returns true only if the picker was actually driven AND reported a range back. */
    function syncCalendarToPreset(key){
      var cal = findCalendar();
      /* __udrCtrl, NICHT __udrController. Die Standalone-Fassung fragte den falschen Namen ab --
         der Zweig war damit immer false, der Picker wurde nie mitgezogen und stand bei "Last 7
         Days", egal was im Popup gewaehlt war. Gemessen: Popup zeigte 30 Tage, der Kalender
         weiterhin 7. Fallback ueber setDateRangePreset, falls die Datei ihre Innereien einmal
         anders benennt -- die globale Funktion ist der dokumentierte Weg. */
      var ctrl = cal && cal.__udrCtrl;
      if (ctrl && typeof ctrl.setPreset === "function"){
        try { if (ctrl.setPreset(key, false) === false) return false; } catch(e){ return false; }
      } else if (window.setDateRangePreset){
        try { if (window.setDateRangePreset(calendarId(), key, false) === false) return false; } catch(e){ return false; }
      } else return false;
      if (!cal) return false;
      var f = parseIso(cal.getAttribute("data-date-from"));
      var t = parseIso(cal.getAttribute("data-date-to"));
      if (!f || !t) return false;
      state.from = f; state.to = t;
      return true;
    }

    /* ---------------- Kalender ----------------
       Die Standalone-Fassung holte sich einen fremden Picker von der Seite, schob seinen Knoten
       in den Dialog und nach dem Schliessen wieder zurueck. Das verlangte auf JEDER Seite ein
       zweites, unsichtbares Element -- und wo es fehlte, stand "Date picker not found".
       Diese Komponente legt sich ihren Picker jetzt selbst an: ein .udr-root im Slot, aufgebaut
       von filters/date-range.js. Deren Datei wird dabei NICHT angefasst; benutzt werden nur ihre
       oeffentlichen Wege -- date-range.js sucht von sich aus nach neuen .udr-root-Elementen,
       __udrCtrl ist der fertige Controller, und das Fenster-Ereignis upstreem:date-range meldet
       jede bestaetigte Auswahl zurueck. Panelposition, Presets, Grenzen und die drei bubble_fn_udr_*-Workflows
       bleiben damit genau die, die sich bewaehrt haben. */
    var calBuilt = false;
    /* Eigene Kennung, abgeleitet von der Instanz: zwei Export-Elemente auf einer Seite bekommen
       so zwei Picker, die sich nicht gegenseitig umstellen. data-calendar-id wird weiterhin
       gelesen -- wer schon ein Element verdrahtet hat, behaelt es. */
    /* Die Kennung des eigenen Pickers IST die Instanz-Kennung. Ein Praefix davor war unnoetig:
       date-range sucht nur unter .udr-root-Elementen, und das Export-Element traegt diese Klasse
       nicht -- eine Kollision ist damit ausgeschlossen. Gleiche Kennung heisst: in der Konsole
       steht der Name, den man auch im Editor sieht. */
    function calendarId(){
      var vorgabe = String(root.getAttribute("data-calendar-id") || "").trim();
      if (vorgabe && vorgabe !== "dates_v2_export") return vorgabe;
      return instanceId;
    }
    function findCalendar(){
      var id = calendarId();
      var all = document.querySelectorAll(".udr-root, [data-udr-root]");
      for (var i = 0; i < all.length; i++){
        var el = all[i];
        var eid = String(el.getAttribute("data-instance") || el.getAttribute("data-instance-id") || "").trim();
        if (eid === id) return el;
      }
      return null;
    }
    function adoptCalendar(){
      var vorhanden = findCalendar();
      /* Liegt schon einer auf der Seite -- etwa weil data-calendar-id auf ein bestehendes Element
         zeigt -- wird der benutzt, aber NICHT verschoben. Verschieben war der Teil, der beim
         Zurueckschieben schiefgehen konnte. */
      if (vorhanden && vorhanden.parentNode !== elCalSlot){
        watchCalendarOpenState(); syncCalendarToState(); return;
      }
      if (!calBuilt){
        calBuilt = true;
        var d = document.createElement("div");
        d.className = "udr-root";
        d.setAttribute("data-instance", calendarId());
        /* Dieselbe Untergrenze, die der Picker sonst auch hat -- ohne Angabe faellt er auf den
           1.1.2024 zurueck, und ein Export darf nicht weiter zurueckreichen als die Daten. */
        var min = root.getAttribute("data-min-date");
        if (min) d.setAttribute("data-min-date", min);
        elCalSlot.innerHTML = "";
        elCalSlot.appendChild(d);
      }
      /* KEIN resetUpstreemDateRangePicker mehr. Der Aufruf sollte den Aufbau anstossen, fand das
         Element aber nicht -- und jeder Fehlversuch schrieb eine lange Warnung in die Konsole.
         Mit den Wiederholungen wurden daraus zwoelf Warnungen pro Oeffnen.
         Das Element steht im DOM; date-range.js sucht ohnehin alle 1,5s nach neuen Wurzeln und
         baut sie auf. Hier wird nur noch abgewartet, ob der Controller erscheint. Bis zu 20
         Versuche a 150ms sind 3 Sekunden -- laenger als der Takt dort, also reicht es in jedem
         Fall, und zwar ohne eine einzige Zeile in der Konsole. */
      var versuche = 0;
      (function warten(){
        var cal = null;
        try { cal = findCalendar(); } catch(e){}
        if (cal && cal.__udrCtrl){ sicherFertig(cal); return; }
        if (++versuche < 20){ setTimeout(warten, 150); return; }
        sicherFertig(cal);
      })();
    }
    /* Die Warteschleife laeuft verzoegert und damit ausserhalb des try in openPopup -- ein Wurf
       hier landete sonst als unbehandelter Fehler in der Konsole und liess den Custom-Bereich in
       einem halben Zustand zurueck. */
    function sicherFertig(cal){
      try { fertig(cal); }
      catch(e){ if (window.console) console.warn("[upstreem-export] Kalender-Nachbereitung:", e); }
    }
    /* Zweiter Teil von adoptCalendar, aufgerufen sobald der Picker steht oder endgueltig fehlt. */
    function fertig(cal){
      var note = elCustomWrap.querySelector(".uex-cal-missing");
      if (!cal){
        /* date-range.js ist nicht geladen. Dann fehlt der Loader-Block, und das gehoert gesagt --
           ein stumm ausgegrauter Knopf sieht aus wie eine Design-Entscheidung. */
        elCustomBtn.disabled = true;
        elCustomBtn.style.opacity = "0.45";
        elCustomBtn.style.cursor = "default";
        if (!note){
          note = document.createElement("span");
          note.className = "uex-cal-missing";
          elCustomWrap.appendChild(note);
        }
        note.textContent = "Date picker could not be created — is filters/date-range.js loaded?";
        return;
      }
      elCustomBtn.disabled = false;
      elCustomBtn.style.opacity = "";
      elCustomBtn.style.cursor = "";
      if (note && note.parentNode) note.parentNode.removeChild(note);
      watchCalendarOpenState();
      syncCalendarToState();
    }
    /* The picker keeps aria-expanded on its trigger in sync with its panel, which makes it the
       cleanest signal for "the calendar is currently open" — no polling, no reaching into the
       picker's internals. Used to give the Custom-range row its half-selected border. */
    function watchCalendarOpenState(){
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (!trig || trig.__uexWatched) return;
      trig.__uexWatched = true;
      var apply = function(){
        elCustomBtn.classList.toggle("is-cal-open", trig.getAttribute("aria-expanded") === "true");
      };
      new MutationObserver(apply).observe(trig, { attributes: true, attributeFilter: ["aria-expanded"] });
      apply();
    }
    /* The popup is what the user is looking at, so the popup's selection wins: on adoption the
       picker is driven to match it. Only when the popup is on a custom range (which came FROM the
       picker in the first place) is there nothing to push. */
    function syncCalendarToState(){
      if (state.preset && state.preset !== "custom"){
        if (syncCalendarToPreset(state.preset)){ persist(); renderAll(); }
        return;
      }
      var cal = findCalendar();
      if (!cal) return;
      var f = parseIso(cal.getAttribute("data-date-from"));
      var t = parseIso(cal.getAttribute("data-date-to"));
      if (f && t){ state.from = f; state.to = t; renderAll(); }
    }
    /* Nichts mehr zurueckzuschieben -- der Picker gehoert dieser Komponente und bleibt, wo er ist.
       Die Funktion bleibt als leerer Aufruf bestehen, damit die beiden Aufrufstellen unveraendert
       lesbar sind. */
    /* Beim Schliessen des Dialogs muss auch das Kalenderfeld zu. Sonst bleibt das Panel offen im
       Dokument stehen -- es haengt in .udr-wrap innerhalb des Dialogs, wandert also mit ihm aus
       dem Bild, ist aber beim naechsten Oeffnen sofort wieder aufgeklappt.
       Ueber den Trigger, nicht ueber die Klassen: der Picker haelt seinen Zustand intern
       (setOpen), und ein von aussen entferntes is-open liesse ihn glauben, er sei noch offen --
       der naechste Klick wuerde dann zumachen statt aufmachen. Sein Controller bietet kein
       close() an, der Trigger schaltet aber um, und aria-expanded sagt verlaesslich, ob das
       noetig ist. */
    function closeCalendar(){
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (trig && trig.getAttribute("aria-expanded") === "true"){
        try { trig.click(); } catch(e){}
      }
      elCustomBtn.classList.remove("is-cal-open");
    }
    function returnCalendar(){ closeCalendar(); }

    // the picker announces every committed range on window — that's our custom-range input
    if (!root.__uexRangeBound){
      root.__uexRangeBound = true;
      window.addEventListener("upstreem:date-range", function(ev){
        var d = ev && ev.detail;
        if (!d || String(d.instance_id || "") !== calendarId()) return;
        var f = parseIso(d.date_from), t = parseIso(d.date_to);
        if (!f || !t) return;
        state.preset = "custom"; state.from = f; state.to = t;
        persist(); renderAll();
      });
    }

    /* ---------------- open / close ---------------- */
    var lastFocus = null;
    function openPopup(){
      if (state.open) return;
      /* Das eigene Overlay MUSS im Dokument haengen. Auf einer Seite mit mehreren Elementen
         derselben data-instance -- beim Nutzer sechs -- raeumt jeder neu gebaute Controller die
         Overlays "seiner" Instanz weg, auch die seiner Geschwister. Der Controller, der dann
         oeffnet, setzte is-open auf einem Knoten, der nicht mehr im Dokument war: kein Fehler,
         keine Warnung, kein Dialog. Genau das Bild.
         Wieder anhaengen statt neu bauen -- alle Verweise und Zuhoerer bleiben damit gueltig. */
      if (!overlay.isConnected){
        var fremd = document.querySelectorAll('.uex-overlay[data-uex-instance="' + instanceId + '"]');
        for (var f = 0; f < fremd.length; f++){
          if (fremd[f] !== overlay && fremd[f].parentNode) fremd[f].parentNode.removeChild(fremd[f]);
        }
        document.body.appendChild(overlay);
      }
      syncTheme();
      /* Der Kalender ist Beiwerk, das Oeffnen ist die Hauptsache. Wirft irgendetwas beim Anlegen
         oder Suchen des Pickers, kam der Dialog frueher gar nicht mehr hoch -- gemessen beim
         Nutzer: is-open blieb false, kein Inline-Stil, der Dialog unsichtbar da. Ein Fehler hier
         darf hoechstens den Custom-Bereich kosten, nie den ganzen Export. */
      try { adoptCalendar(); }
      catch(e){
        if (window.console) console.warn("[upstreem-export] Kalender konnte nicht vorbereitet " +
          "werden — der Dialog oeffnet trotzdem, nur der Custom-Bereich fehlt:", e);
      }
      try { renderAll(); } catch(e){}
      lastFocus = document.activeElement;
      overlay.inert = false;
      overlay.setAttribute("aria-hidden", "false");
      /* is-shown ist der Zustand des Core-Popups, is-open bleibt fuer die eigenen Regeln. */
      overlay.classList.add("is-open", "is-shown");
      document.body.classList.add("uex-popup-open");   // lifts the picker's panel above us
      btn.setAttribute("aria-expanded", "true");
      state.open = true;
      try { overlay.querySelector(".uex-submit").focus({ preventScroll: true }); } catch(e){}
    }
    function closePopup(){
      if (!state.open) return;
      // never hide a focused element from assistive tech — move focus out FIRST
      if (overlay.contains(document.activeElement)){
        try {
          if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
          else btn.focus({ preventScroll: true });
        } catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      overlay.classList.remove("is-open", "is-shown");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      document.body.classList.remove("uex-popup-open");
      btn.setAttribute("aria-expanded", "false");
      state.open = false;
      if (state.processing) setProcessing(false);   // defensive: don't leave a stale timer/state behind
      /* SOFORT, nicht verzoegert: das Panel soll mit dem Dialog verschwinden, nicht erst danach.
         Zurueckzuschieben gibt es nichts mehr -- der Kalender gehoert dieser Komponente. */
      closeCalendar();
    }

    function setProcessing(on){
      state.processing = !!on;
      elBody.classList.toggle("is-processing", state.processing);
      elClose.disabled = state.processing;
      elCancel.disabled = state.processing;
      elSubmit.disabled = state.processing;
      elSubmitIcon.innerHTML = state.processing ? SPINNER_SVG : EXPORT_SVG;
      elSubmitText.textContent = state.processing ? "Exporting…" : "Export";
      if (state.processing){
        // Safety net only — this should essentially never fire for a real export. It exists so a
        // missing/forgotten window.upstreemExportResolve() call can't strand the dialog in a
        // permanent spinner with no way out except reloading the page.
        clearTimeout(root.__uexProcessingTimeout);
        root.__uexProcessingTimeout = setTimeout(function(){
          if (!state.processing) return;
          console.warn("[upstreem-export] no window.upstreemExportResolve('" + instanceId +
            "') arrived within 90s — ending the processing state so the dialog isn't stuck. " +
            "If the export genuinely takes longer, call resolve() later; the dialog will still close correctly.");
          setProcessing(false);
        }, 90000);
      } else {
        clearTimeout(root.__uexProcessingTimeout);
      }
    }
    function fireExport(){
      if (state.processing) return;   // already sent, ignore a repeat click
      var fnName = root.getAttribute("data-export-fn") || "bubble_fn_upstreemExport";
      var fn = resolveBubbleFn(fnName);
      /* Rueckfall auf den Namen OHNE Instanz-Suffix. Beim Nutzer stand data-export-fn auf
         bubble_fn_upstreemExport_prompt_runs, das JavaScriptToBubble-Element hiess aber
         bubble_fn_upstreemExport -- ein Element fuer alle Platzierungen, was voellig in Ordnung
         ist: der Payload traegt export_type, der Workflow weiss also, worum es geht.
         Ohne diesen Rueckfall scheitert jede Platzierung, deren Suffix nicht exakt zum
         Elementnamen passt, und der Fehler sieht aus wie "Export tut nichts". */
      if (typeof fn !== "function"){
        /* Auf den GRUNDNAMEN zurueck, nicht per Regex das letzte Stueck abschneiden: das Suffix
           kann selbst Unterstriche enthalten (_prompt_runs), und dann bliebe
           bubble_fn_upstreemExport_prompt uebrig -- wieder kein Treffer. */
        var ohneSuffix = "bubble_fn_upstreemExport";
        if (ohneSuffix !== fnName && fnName.indexOf(ohneSuffix) === 0){
          var alt2 = resolveBubbleFn(ohneSuffix);
          /* Still. Der Rueckfall ist der Normalfall, nicht die Ausnahme: EIN
             JavaScriptToBubble-Element fuer alle Platzierungen ist hier die richtige Verdrahtung,
             weil der Payload export_type traegt und der Workflow danach verzweigt. Eine Warnung
             dafuer waere Meckern ueber etwas, das stimmt. */
          if (typeof alt2 === "function"){ fn = alt2; fnName = ohneSuffix; }
        }
      }
      /* Same shape as every other component here (see Mira's miraAction): ONE JSON string as the
         single argument, values pulled out on the Bubble side by regex. A Toolbox
         "Javascript to Bubble" element only captures the first argument anyway. */
      var payload = {
        export_type: state.type,
        date_from: isoDate(state.from),
        date_to: isoDate(state.to),
        /* Computed directly from the selected dates — no arithmetic needed on the Bubble side, and
           therefore no way for a days-vs-milliseconds unit mismatch to sneak back in (that's what
           made every range collapse to "today and yesterday": date_range added as if it were
           already milliseconds shifts the boundary by a few hundred ms, not by days). Both are
           START OF DAY in the browser's local timezone, matching what date_from/date_to already
           represent — so to_unix is the start of the LAST included day, not its end. If your
           backend query needs the end of that day, use `< to_unix + 86400000` (one day in ms)
           rather than `<= to_unix`. */
        from_unix: utcMidnight(state.from),
        to_unix: utcMidnight(state.to),
        // Negative on purpose: the workflow that (previously) built from_unix/to_unix on the
        // Bubble side added date_range to to_unix rather than subtracting it, which — with a
        // positive value — moved from_unix LATER than to_unix and produced "invalid date range".
        // Flipping the sign here made that addition land correctly. Now that from_unix/to_unix
        // above remove the need for that arithmetic entirely, this is kept only for anything else
        // that might still read it (e.g. a human-readable "N days" display) — for computing the
        // actual boundaries, prefer from_unix/to_unix.
        date_range: -dayCount(state.from, state.to),
        token: String(state.token == null ? "" : state.token)
      };
      var payloadJson;
      try { payloadJson = JSON.stringify(payload); } catch(e){ payloadJson = ""; }
      if (typeof fn === "function"){
        try { fn(payloadJson); } catch(e){}
      } else {
        // Visible on purpose: silently doing nothing here is exactly what made this look like
        // "clicking Export just closes the popup and nothing happens" — the dialog used to close
        // unconditionally regardless of whether Bubble ever received anything. Check that a
        // Toolbox "Javascript to Bubble" element exposes exactly this name.
        var vorhanden = [];
        try {
          for (var k in window) if (/^bubble_fn_/.test(k)) vorhanden.push(k);
        } catch(e){}
        console.warn("[upstreem-export] " + fnName + " nicht gefunden — der Export-Workflow wurde " +
          "nicht ausgeloest. Der Dialog bleibt sichtbar im Ladezustand und faellt nach 90s zurueck, " +
          "statt still zu schliessen.\nGefundene bubble_fn_* in diesem Fenster: " +
          (vorhanden.length ? vorhanden.join(", ") : "keine") +
          "\nStimmt data-export-fn am Element mit dem Namen des JavaScriptToBubble-Elements ueberein?");
      }
      try {
        root.dispatchEvent(new CustomEvent("upstreem-export", { detail: payload, bubbles: true }));
      } catch(e){}
      setProcessing(true);
    }

    /* ---------------- listeners ---------------- */
    btn.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); openPopup(); });

    overlay.addEventListener("click", function(e){
      if (state.processing) return;   // locked until window.upstreemExportResolve() is called
      // click on the backdrop (not inside the dialog) closes
      if (!elDialog.contains(e.target)){ closePopup(); return; }
      var typeBtn = e.target.closest("[data-type]");
      if (typeBtn){ state.type = typeBtn.getAttribute("data-type"); persist(); renderAll(); return; }
      var presetBtn = e.target.closest("[data-preset]");
      if (presetBtn){ applyPreset(presetBtn.getAttribute("data-preset")); return; }
      if (e.target.closest(".uex-close") || e.target.closest(".uex-cancel")){ closePopup(); return; }
      if (e.target.closest(".uex-submit")){ fireExport(); return; }
    });

    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && state.open && !state.processing){
        // let the calendar close its own panel first if that's what's open
        /* .udr-menu, nicht .udr-panel -- den Selektor gibt es nicht, die Pruefung lief also
           immer ins Leere und Escape schloss den Dialog samt offenem Kalender. */
        var calPanel = document.querySelector(".udr-menu.is-shown, .udr-wrap.is-open");
        if (calPanel) return;
        closePopup();
      }
    });

    new MutationObserver(syncTheme).observe(root, {
      attributes: true, attributeFilter: ["data-isdark"]
    });
    // reconcile once right after attaching: the value may have resolved between the initial
    // read above and this observer existing, and that change would otherwise be lost
    syncTheme();

    new MutationObserver(function(){
      var t = normType(root.getAttribute("data-export-type"));
      if (t && t !== state.type){ state.type = t; persist(); renderAll(); }
      var tok = root.getAttribute("data-token");
      if (tok != null && tok !== "EXPORT_ACCESSTOKEN" && tok !== state.token){ state.token = tok; persist(); }
    }).observe(root, { attributes: true, attributeFilter: ["data-export-type", "data-token"] });

    renderAll();

    return {
      root: root,
      open: openPopup,
      close: closePopup,
      isOpen: function(){ return !!state.open; },
      isProcessing: function(){ return !!state.processing; },
      /*
        Bubble Toolbox → Run JavaScript, called once the export workflow has actually finished:
        window.upstreemExportResolve("YOUR_INSTANCE_ID");
        Ends the processing state and closes the dialog. A no-op if the dialog isn't
        currently processing (safe to call defensively / more than once).
      */
      resolveProcessing: function(){
        if (!state.processing) return false;
        setProcessing(false);
        closePopup();
        return true;
      },
      setContext: function(opts){
        opts = opts || {};
        var t = normType(opts.export_type != null ? opts.export_type : opts.type);
        if (t) state.type = t;
        var tok = (opts.export_accesstoken != null) ? opts.export_accesstoken : opts.token;
        if (tok != null) state.token = String(tok);
        persist(); renderAll();
        return true;
      },
      destroy: function(){
        returnCalendar();
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (root.__uexController === this) root.__uexController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__uexController) return root.__uexController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uexController = ctrl;
    return ctrl;
  }
  function initAll(){
    var roots = document.querySelectorAll(".uex-root");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  }
  function rootsWithId(id){
    var out = [], roots = document.querySelectorAll(".uex-root");
    for (var i = 0; i < roots.length; i++){
      if (roots[i].getAttribute("data-instance") === id) out.push(roots[i]);
    }
    return out;
  }
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    // instanceId collision (this reusable placed twice): prefer the visible one
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  function doOpen(id, opts){
    var ctrl = resolve(id);
    if (!ctrl) return false;
    if (opts) ctrl.setContext(opts);
    ctrl.open();
    return true;
  }
  function doClose(id){ var c = resolve(id); if (!c) return false; c.close(); return true; }
  function doSetContext(id, opts){ var c = resolve(id); if (!c) return false; return c.setContext(opts); }
  function doResolve(id){ var c = resolve(id); if (!c) return false; return c.resolveProcessing(); }

  window.upstreemExportOpen = doOpen;
  window.upstreemExportClose = doClose;
  window.upstreemExportSetContext = doSetContext;
  window.upstreemExportResolve = doResolve;
  window.__uexResolveLocal = function(id){ return rootsWithId(id).length > 0; };

  /* ================= forwarder on parent AND top (nested reusables) =================
     If this component sits on a reusable that is itself placed on ANOTHER reusable, a Bubble
     "Run Javascript" step usually executes at window.top — two or more iframe layers above this
     script. Walk the full iframe tree and deliver only to the frame that owns the instanceId. */
  (function exposeUpward(){
    var targets = [];
    try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch(e){}
    try { if (window.top && window.top !== window && targets.indexOf(window.top) === -1) targets.push(window.top); } catch(e){}
    if (!targets.length) return;
    function makeDeliver(w){
      return function(fnName, id, arg1, arg2){
        var queue = [w], seen = [];
        while (queue.length){
          var win = queue.shift(), ifr;
          try { ifr = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
          for (var i = 0; i < ifr.length; i++){
            var cw; try { cw = ifr[i].contentWindow; } catch(e){ cw = null; }
            if (!cw || seen.indexOf(cw) !== -1) continue;
            seen.push(cw); queue.push(cw);
          }
        }
        for (var a = 0; a < seen.length; a++){
          try {
            var c = seen[a];
            if (c && typeof c[fnName] === "function" && c.__uexResolveLocal && c.__uexResolveLocal(id)) return c[fnName](arg1, arg2);
          } catch(e){}
        }
        for (var b = 0; b < seen.length; b++){
          try { var c2 = seen[b]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){}
        }
        return false;
      };
    }
    for (var t = 0; t < targets.length; t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.upstreemExportOpen = function(id, opts){ return deliver("upstreemExportOpen", id || "default", id, opts); };
          w.upstreemExportClose = function(id){ return deliver("upstreemExportClose", id || "default", id); };
          w.upstreemExportSetContext = function(id, opts){ return deliver("upstreemExportSetContext", id || "default", id, opts); };
          w.upstreemExportResolve = function(id){ return deliver("upstreemExportResolve", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
  setInterval(initAll, 1500);   // cheap no-op once initialised; catches late Bubble rebuilds
  new MutationObserver(function(muts){
    for (var i = 0; i < muts.length; i++){
      if (muts[i].addedNodes && muts[i].addedNodes.length){ initAll(); return; }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
