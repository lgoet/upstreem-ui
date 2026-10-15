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

  /* gruppe (16.10.): der Dialog zeigt nur die Datensaetze EINER Gruppe -- die des gewaehlten Typs.
     "" sind die Datensaetze von Prompts, Citations und Brands; Shopping und Ads oeffnen ihn mit
     ihren eigenen (export_type aus ihrer Gruppe), und nach dem Schliessen gilt wieder der letzte
     Typ der Grundgruppe (stammTyp) -- ein spaeteres Oeffnen ohne Typ zeigt nie Shopping. */
  var TYPES = [
    { value: "prompts",     label: "Prompts",   gruppe: "" },
    { value: "prompt_runs", label: "Responses", gruppe: "" },
    { value: "domains",     label: "Domains",   gruppe: "" },
    { value: "urls",        label: "URLs",      gruppe: "" },
    { value: "brands",      label: "Brands",    gruppe: "" },
    { value: "shop_products",    label: "Products",         gruppe: "shopping" },
    { value: "shop_brands",      label: "Brands",           gruppe: "shopping" },
    { value: "shop_merchants",   label: "Merchants",        gruppe: "shopping" },
    { value: "shop_appearances", label: "Appearances",      gruppe: "shopping" },
    { value: "ads_advertisers",  label: "Advertisers",      gruppe: "ads" },
    { value: "ads_library",      label: "Ad Library",       gruppe: "ads" },
    /* kachel: der Name auf der Kachel, wo label nicht passt. "Prompts with Ads" braucht 112px Text,
       die Kachel hat bei drei Spalten 103 (gemessen 16.10.) -- "Prompts" ist das Wort des
       Umschalters Ads | Prompts in der Ad Library; die Zusammenfassung nennt den ganzen Namen. */
    { value: "ads_prompts",      label: "Prompts with Ads", kachel: "Prompts", gruppe: "ads" }
  ];
  /* Der Satz, solange es die Exporte einer Gruppe noch nicht gibt. Ganz ohne Technik: der Nutzer
     kann nichts tun ausser warten, und genau das sagt er. */
  var GRUPPEN = {
    shopping: { bald: "Exports for Shopping are coming soon." },
    ads: { bald: "Exports for Ads are coming soon." }
  };
  function typVon(v){ for (var i = 0; i < TYPES.length; i++) if (TYPES[i].value === v) return TYPES[i]; return null; }
  function gruppeVon(v){ var x = typVon(v); return x ? x.gruppe : ""; }
  /* Die Texte, die es nur hier gibt. Die Namen der Datensaetze stehen schon in ads.js -- mit
     demselben Wert, damit der Dialog auch dann deutsch ist, wenn Ads nie geladen wurde. Kein
     Schluessel aus core (Katalog-Kollision). Eingetragen beim ersten Controller, nicht beim Laden:
     diese Datei kommt ohne core aus, und steht sie im Loader vor core, waere der Katalog sonst leer. */
  var katalogDa = false;
  function katalog(){
    var C = window.UpstreemCore;
    if (katalogDa || !C || !C.addMessages) return;
    katalogDa = true;
    C.addMessages("de", {
      "Exports for Shopping are coming soon.": "Exporte für Shopping kommen bald.",
      "Exports for Ads are coming soon.": "Exporte für Ads kommen bald.",
      "This export is coming soon.": "Dieser Export kommt bald.",
      "Current page filters apply.": "Es gelten die aktuellen Filter der Seite.",
      "Advertisers": "Werbetreibende", "Ad Library": "Anzeigenbibliothek",
      "Prompts with Ads": "Prompts mit Ads", "Appearances": "Auftritte"
    });
  }
  function tr(x){ var C = window.UpstreemCore; return C && C.t ? C.t(x) : x; }
  /* Keys are deliberately the SAME strings the date range picker uses for its own presets,
     so syncing the two is a straight pass-through with nothing to translate. */
  var PRESETS = [
    { key: "last7",  label: "Last 7 Days",   days: 7  },
    { key: "last30", label: "Last 30 Days",  days: 30 },
    { key: "last3",  label: "Last 3 Months", months: 3 },
    { key: "last6",  label: "Last 6 Months", months: 6 }
  ];

  var CHECK_SVG = '<span class="uex-opt-check" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24"><path d="M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7"/></svg></span>';

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }
  /* Kennt core ein Thema, gewinnt core: data-isdark ist die Momentaufnahme aus dem Moment, in dem
     der Bubble-Workflow lief, und wer sie direkt ins data-theme schreibt, dreht sich beim naechsten
     Aufruf selbst zurueck. Diese Datei haelt keine UC-Variable -- sie kommt ohne core aus --,
     deshalb der direkte Griff mit Rueckfall auf das Attribut. */
  function dunkelJetzt(v){
    var C = window.UpstreemCore;
    return (C && C.themeParam) ? C.themeParam(v) : isYes(v);
  }
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
    /* Die EIGENE Suche, nicht die aus core. Ich hatte hier UC.resolveBubbleFn vorangestellt, weil
       es die gepflegtere Fassung ist -- danach kam der Export nicht mehr an, obwohl er vorher
       lief und der Aufruf nachweislich bei window.bubble_fn_upstreemExport ankam. Was core
       zusaetzlich tut (Cache, Frame-Behandlung), ist hier offenbar nicht neutral. Der Grund ist
       nicht aufgeklaert; zurueck auf den Stand, der funktioniert hat.
       Wer das eines Tages vereinheitlichen will, muss es an einer echten Seite messen, nicht im
       Harness -- dort liefen beide Wege. */
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
  /* Welche Exporte von Shopping und Ads es gibt (pruefen im Controller), je Spaltenschluessel:
     { stand: true | false | null, spalten, laeuft }. Am window, fuer alle Controller und ueber
     einen Neuaufbau hinweg; jede Antwort zeichnet offene Dialoge neu (Ereignis uex-verfuegbar). */
  var DA = (window.__uexDa = window.__uexDa || {});
  function daGeaendert(){
    try { window.dispatchEvent(new CustomEvent("uex-verfuegbar")); } catch(e){}
  }

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};
    /* KEIN Knopf. Diese Komponente ist nur der Dialog -- geoeffnet wird sie von den
       Export-Knoepfen der anderen Komponenten ueber upstreemExportOpen(instanceId). Das Element
       auf der Seite ist ein reiner Traeger und soll nichts anzeigen und nichts anklickbar machen.
       Ein Knopf im Markup wird trotzdem respektiert: wer die Standalone-Fassung eingebaut hat,
       behaelt ihn, ohne etwas nachziehen zu muessen. */
    var btn = root.querySelector(".uex-btn");

    var isDark = dunkelJetzt(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    katalog();
    var today = startOfDay(new Date());
    var state = {
      type: normType(root.getAttribute("data-export-type")) || saved.type || TYPES[0].value,
      token: root.getAttribute("data-token") || saved.token || "",
      preset: saved.preset || "last7",
      from: parseIso(saved.from) || addDays(today, -6),
      to: parseIso(saved.to) || today,
      open: false,
      processing: false,
      /* Kontext einer Seite mit eigener Gruppe (Shopping, Ads; setContext): die Parameter je Typ
         und ob davon Filter der Seite sind. Wie url/domain nur fuer DIESEN Export, beim
         Schliessen geleert. */
      params: {}, filterAktiv: {}, zeitVonSeite: false
    };
    if (gruppeVon(state.type)) state.type = TYPES[0].value;
    state.stammTyp = state.type;
    /* Jeder Typwechsel hierueber: ein Typ der Grundgruppe wird der, zu dem der Dialog nach einem
       Shopping- oder Ads-Export zurueckkehrt. */
    function typSetzen(v){
      state.type = v;
      if (!gruppeVon(v)) state.stammTyp = v;
    }

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
        type: state.stammTyp, token: state.token, preset: state.preset,
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
              'stroke-linecap="round"><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"/></svg>' +
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
                '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 2V6M8 2V6"/><path d="M13 4H11C7.22876 4 5.34315 4 4.17157 5.17157C3 6.34315 3 8.22876 3 12V14C3 17.7712 3 19.6569 4.17157 20.8284C5.34315 22 7.22876 22 11 22H13C16.7712 22 18.6569 22 19.8284 20.8284C21 19.6569 21 17.7712 21 14V12C21 8.22876 21 6.34315 19.8284 5.17157C18.6569 4 16.7712 4 13 4Z"/><path d="M3 10H21"/></svg>' +
                '<span class="uex-opt-label uex-custom-text">Custom range</span>' +
                '<span class="uex-opt-check" aria-hidden="true">' +
                  '<svg viewBox="0 0 24 24"><path d="M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7"/></svg>' +
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
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z"/><path d="M5.00006 21H19.0001"/></svg>' +
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
    var elBody    = overlay.querySelector(".uex-body");
    var elDialog  = overlay.querySelector(".uex-dialog");
    var elBody    = overlay.querySelector(".uex-body");
    var elClose   = overlay.querySelector(".uex-close");
    var elCancel  = overlay.querySelector(".uex-cancel");
    var elSubmit  = overlay.querySelector(".uex-submit");
    var elSubmitIcon = overlay.querySelector(".uex-submit-icon");
    var elSubmitText = overlay.querySelector(".uex-submit-text");
    var SPINNER_SVG = '<span class="uex-spin" aria-hidden="true"></span>';
    var EXPORT_SVG =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z"/><path d="M5.00006 21H19.0001"/></svg>';

    function syncTheme(){
      var dark = dunkelJetzt(root.getAttribute("data-isdark"));
      isDark = dark;
      if (dark){ root.setAttribute("data-theme","dark"); overlay.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); overlay.removeAttribute("data-theme"); }
    }

    function renderTypes(){
      var g = gruppeVon(state.type);
      elTypes.innerHTML = TYPES.filter(function(t){ return t.gruppe === g; }).map(function(t){
        return '<button class="uex-opt' + (t.value === state.type ? " is-active" : "") +
               '" type="button" data-type="' + esc(t.value) + '">' +
               '<span class="uex-opt-label">' + esc(tr(t.kachel || t.label)) + '</span>' + CHECK_SVG + '</button>';
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
      var label = typVon(state.type);
      /* Fehlt der Export noch (Shopping, Ads), steht statt der Zusammenfassung der Satz, und der
         Knopf ruht -- kein Fehler, kein Klick ins Leere. */
      var bald = baldSatz(state.type);
      if (bald){ elSummary.textContent = bald; knopfStand(); return; }
      elSummary.innerHTML =
        "Exporting <b>" + esc(label ? tr(label.label) : state.type) + "</b> from <b>" +
        esc(prettyDate(state.from)) + "</b> to <b>" + esc(prettyDate(state.to)) +
        "</b> &mdash; <b>" + dayCount(state.from, state.to) + "</b> days." +
        /* Die Seite gibt ihre Filter mit (setContext params) -- dann sagt es der Dialog. */
        (state.filterAktiv[state.type] ? " " + esc(tr("Current page filters apply.")) : "");
      knopfStand();
    }
    /* renderAll zeichnet Typen, Voreinstellungen und Zusammenfassung -- also den GANZEN Inhalt
       des Dialogs. Am Aufruf beim Oeffnen stand ein leerer Faenger ohne Rueckfall: warf hier
       etwas, ging der Dialog leer auf, und leer sah damit genauso aus wie kaputt. Jetzt sagt er,
       dass er sich nicht aufbauen liess, und was zu tun ist. Kein interner Name, kein Verweis
       auf die Konsole.
       window.UpstreemCore direkt und mit Rueckfall, wie ueberall in dieser Datei: sie kommt ohne
       core aus (siehe setContext), und gerade der Fehlerfall darf nicht an einem fehlenden UC
       scheitern. */
    function aufbauFehler(){
      if (!elBody) return;
      var C = window.UpstreemCore;
      elBody.innerHTML = (C && C.leerHtml)
        ? C.leerHtml({ icon: "info", knopf: "",
            titel: "Export options could not be shown",
            text: "Please reload the page and try again." })
        : '<div class="up-empty">' +
            '<div class="up-empty-h">Export options could not be shown</div>' +
            '<div class="up-empty-t">Please reload the page and try again.</div>' +
          '</div>';
    }
    function renderAll(){
      try { renderTypes(); renderPresets(); renderSummary(); }
      catch(e){ aufbauFehler(); }
    }

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
        /* Lokal (13.10.): der Dialog liest den Zeitraum ueber __udrCtrl und upstreem:date-range, beides
           kommt auch lokal. Ohne das feuerte jede Wahl die Bubble-Namen bubble_fn_udr_date_* -- und
           lag noch ein alter Kalender mit genau diesen Namen auf der Seite, lud der seine Ansicht neu. */
        d.setAttribute("data-local", "yes");
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
      /* Still: der Custom-Bereich zeigt im Dialog selbst, ob er benutzbar ist. Eine
         Konsolenzeile daneben ist Debug-Ausgabe in der ausgelieferten App. */
      catch(e){}
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
        /* Der Nutzer bekommt zu lesen, was er tun kann -- nicht, welche Datei fehlt. Vorher stand
           hier "Date picker could not be created -- is filters/date-range.js loaded?": ein
           Dateiname im Nutzer-UI, und die Frage richtet sich an jemanden, der nicht davorsitzt.
           Der Grund gehoert in die Konsole (eine Zeile darunter), nicht auf den Bildschirm. */
        note.textContent = "Custom range is unavailable. Please reload the page.";
        if (window.console) console.error("upstreem export-data: filters/date-range.js fehlt im " +
          "Loader-Block dieses Elements, deshalb gibt es keinen Kalender.");
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
      /* Ein freier Zeitraum, den die SEITE mitgegeben hat (Shopping, Ads), kam nicht vom Picker --
         er wird ihm gegeben, still, und danach gilt wieder, was der Picker sagt (in seine Grenzen
         gezogen). */
      if (state.zeitVonSeite && cal.__udrCtrl && typeof cal.__udrCtrl.setRange === "function"){
        try { cal.__udrCtrl.setRange(isoDate(state.from), isoDate(state.to), false); } catch(e){}
      }
      state.zeitVonSeite = false;
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
      /* Still, aus demselben Grund. Der Dialog oeffnet, und fehlt der Kalender, steht das
         als Hinweis unter dem Custom-Knopf. */
      catch(e){}
      pruefen();
      renderAll();
      lastFocus = document.activeElement;
      overlay.inert = false;
      overlay.setAttribute("aria-hidden", "false");
      /* is-shown ist der Zustand des Core-Popups, is-open bleibt fuer die eigenen Regeln. */
      overlay.classList.add("is-open", "is-shown");
      document.body.classList.add("uex-popup-open");   // lifts the picker's panel above us
      if (btn) btn.setAttribute("aria-expanded", "true");
      state.open = true;
      try { overlay.querySelector(".uex-submit").focus({ preventScroll: true }); } catch(e){}
    }
    function closePopup(){
      if (!state.open) return;
      /* Der Filter des Drawers gilt nur fuer DIESEN Export (siehe setContext). */
      state.url = ""; state.domain = ""; state.promptId = ""; state.brandId = "";
      /* Ebenso Kontext und Gruppe von Shopping und Ads: danach gilt wieder die Grundgruppe. */
      state.params = {}; state.filterAktiv = {}; state.zeitVonSeite = false;
      if (gruppeVon(state.type)) state.type = state.stammTyp;
      // never hide a focused element from assistive tech — move focus out FIRST
      if (overlay.contains(document.activeElement)){
        try {
          if (lastFocus && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });
          else if (btn) btn.focus({ preventScroll: true });
        } catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      overlay.classList.remove("is-open", "is-shown");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      document.body.classList.remove("uex-popup-open");
      if (btn) btn.setAttribute("aria-expanded", "false");
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
      knopfStand();
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
    /* ---- DER EXPORT AUS DER KOMPONENTE (13.10., Vertrag VOR_NEXTJS_V1 Abschnitt 3) --------------
       Vorher: bubble_fn_upstreemExport -> Bubble ruft die Export-RPC mit dem Nutzer-Token, baut die
       Datei, laedt herunter, meldet upstreemExportResolve. Jetzt blaettert der Dialog selbst
       (offset + limit, solange meta.has_more), baut die CSV aus den Spalten von export_columns_v1
       (Reihenfolge und englische Kopfzeile kommen von der Datenbank -- nur diese Schluessel, nicht
       die Rohfelder) und laedt sie herunter. Formelschutz macht die Datenbank (csv_safe_v1 auf jeder
       Textspalte); hier steht trotzdem jedes Feld in Anfuehrungszeichen, " verdoppelt.
       Gibt es eine Funktion mit genau diesen Parametern noch nicht (404 PGRST202), geht DIESER Typ
       fuer die Sitzung wieder an Bubble -- ein Pin vor der SQL schaltet den Export nicht ab. */
    var EXPORTE = {
      prompts:     { fn: "export_prompts_v1",           spalten: "prompts",   seite: 5000 },
      prompt_runs: { fn: "export_responses_v1",         spalten: "responses", seite: 2000 },
      domains:     { fn: "export_citations_domains_v1", spalten: "domains",   seite: 10000 },
      urls:        { fn: "export_citations_urls_v1",    spalten: "urls",      seite: 5000 },
      brands:      { fn: "export_brands_v2",            spalten: "brands",    seite: 500 },
      /* SHOPPING UND ADS (16.10., Auftrag bubble/shopping_ads_export_db_auftrag_16_10.md). neu: kein
         Rueckweg an Bubble (die Seiten gibt es dort nicht), und ob es den Export gibt, fragt der
         Dialog beim Oeffnen export_columns_v1 (pruefen unten). Parameter: die der Seite (params). */
      shop_products:    { fn: "export_shopping_products_v1",    spalten: "shopping_products",    seite: 2000, neu: true, datei: "shopping-products" },
      shop_brands:      { fn: "export_shopping_brands_v1",      spalten: "shopping_brands",      seite: 1000, neu: true, datei: "shopping-brands" },
      shop_merchants:   { fn: "export_shopping_merchants_v1",   spalten: "shopping_merchants",   seite: 2000, neu: true, datei: "shopping-merchants" },
      shop_appearances: { fn: "export_shopping_appearances_v1", spalten: "shopping_appearances", seite: 5000, neu: true, datei: "shopping-appearances" },
      ads_advertisers:  { fn: "export_ads_advertisers_v1",      spalten: "ads_advertisers",      seite: 2000, neu: true, datei: "ads-advertisers" },
      ads_library:      { fn: "export_ads_library_v1",          spalten: "ads_library",          seite: 1000, neu: true, datei: "ads-library" },
      ads_prompts:      { fn: "export_ads_prompts_v1",          spalten: "ads_prompts",          seite: 2000, neu: true, datei: "ads-prompts" }
    };
    /* ---- GIBT ES DEN EXPORT SCHON? (16.10.) -------------------------------------------------------
       Fuer die Typen mit neu fragt der Dialog beim Oeffnen export_columns_v1 nach den Spalten jedes
       Typs seiner Gruppe: ein Aufruf, der keine Daten liest und nicht ins Ratenlimit der Exporte
       zaehlt. Kennt die Datenbank den Export nicht, antwortet sie 400 exports_invalid_param mit hint
       "p_export: ..." (vor_nextjs_v1.sql) -- dann "kommt bald" statt eines Fehlers. Ebenso 404
       PGRST202 (Funktion fehlt ganz) und, beim Export selbst, PGRST202 der Datenfunktion. Alles
       andere (Netz, Zeitablauf, 5xx) heisst "unbekannt": der Knopf geht, und beim naechsten Oeffnen
       wird neu gefragt. Gemerkt fuer das Seitenleben und alle Controller (DA am window) -- ist das
       SQL eingespielt, gilt es nach einem Neuladen ohne weitere Aenderung.
       Waehrend der Frage ruht der Knopf (laeuft): sonst waere er erst klickbar und dann nicht. */
    function spaltenAus(erg){
      var r = erg && erg.ok && erg.daten && Array.isArray(erg.daten.rows) ? erg.daten.rows : null;
      r = r ? r.filter(function(c){ return c && c.key; }) : null;
      return r && r.length ? r : null;
    }
    function exportFehlt(erg){
      if (!erg || erg.ok) return false;
      var f = erg.fehler || {}, m = String(f.message || ""), h = String(f.hint || "");
      if (String(f.code || "") === "PGRST202" ||
          (erg.status === 404 && /could not find the function/i.test(m + " " + String(f.details || "")))) return true;
      return erg.status === 400 && /exports_invalid_param/.test(m) && /p_export/.test(h);
    }
    function daVon(art){
      var cfg = EXPORTE ? EXPORTE[art] : null;
      if (!cfg || !cfg.neu) return null;
      return DA[cfg.spalten] || (DA[cfg.spalten] = { stand: null, spalten: null, laeuft: false });
    }
    function pruefen(){
      var g = gruppeVon(state.type), k = kern();
      if (!g || !k) return;
      TYPES.forEach(function(x){
        if (x.gruppe !== g) return;
        var e = daVon(x.value), cfg = EXPORTE[x.value];
        if (!e || e.stand !== null || e.laeuft) return;
        e.laeuft = true;
        function fertig(){ e.laeuft = false; daGeaendert(); }
        k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
          var r = spaltenAus(erg);
          if (r){ e.stand = true; e.spalten = r; }
          else if (exportFehlt(erg)) e.stand = false;
          fertig();
        }, fertig);
      });
    }
    function gesperrt(art){ var e = daVon(art); return !!e && (e.stand === false || e.laeuft); }
    function baldSatz(art){
      var e = daVon(art), g = gruppeVon(art);
      if (!e || e.stand !== false) return "";
      var alle = TYPES.every(function(x){ var d = x.gruppe === g ? daVon(x.value) : null; return !d || d.stand === false; });
      return tr(alle && GRUPPEN[g] ? GRUPPEN[g].bald : "This export is coming soon.");
    }
    function knopfStand(){ elSubmit.disabled = state.processing || gesperrt(state.type); }
    /* Obergrenze an Seiten je Export: die Datenbank erlaubt 60 Seiten je Minute und Typ. Mehr als
       das passt nicht in einen Lauf, und eine Schleife ohne Ende waere der schlimmere Fehler. */
    var MAX_SEITEN = 60;
    var BUBBLE_TYP = (window.__uexBubbleTyp = window.__uexBubbleTyp || {});
    function kern(){ var k = window.UpstreemCore; return k && typeof k.rpc === "function" && typeof k.getTeam === "function" && k.getTeam() ? k : null; }
    /* Ohne Bubble (die App, UC.ohneBubble): kein Rueckweg, sondern der Fehler, den der Aufrufer schon zeigt (14.10.). */
    function ohneRpc(erg){
      var k = window.UpstreemCore;
      if (k && k.ohneBubble && k.ohneBubble()) return false;
      return !!erg && erg.status === 404 && !!erg.fehler && String(erg.fehler.code || "") === "PGRST202";
    }
    function exportParameter(art, team, offset, limit){
      var p = { p_team: team, p_date_from: isoDate(state.from), p_date_to: isoDate(state.to), p_offset: offset, p_limit: limit };
      /* Die Filter des Drawers (setContext) -- nur dort, wo die Funktion sie kennt. Ein Parameter,
         den sie nicht hat, liesse PostgREST die Funktion gar nicht finden (PGRST202). */
      if (art === "prompt_runs"){
        if (state.url) p.p_url = String(state.url);
        if (state.domain) p.p_domain = String(state.domain);
        if (state.promptId) p.p_prompt_id = String(state.promptId);
        if (state.brandId) p.p_brand = String(state.brandId);
      } else if (art === "domains"){
        if (state.brandId) p.p_brand = String(state.brandId);
      } else if (art === "urls"){
        if (state.domain) p.p_domain = String(state.domain);
        if (state.brandId) p.p_brand = String(state.brandId);
      } else if (EXPORTE[art] && EXPORTE[art].neu){
        /* Shopping und Ads: die Parameter der Seite (setContext params), in den Namen der Liste.
           Team, Zeitraum und Seite gehoeren dem Dialog und werden nie ueberschrieben; null heisst
           "kein Filter" und bleibt draussen -- jede Funktion hat dafuer ihren Standardwert, und ein
           Name weniger ist ein Grund weniger fuer PGRST202. */
        var x = state.params[art] || {};
        Object.keys(x).forEach(function(n){
          if (!/^p_[a-z0-9_]+$/.test(n) || Object.prototype.hasOwnProperty.call(p, n)) return;
          if (x[n] == null || (Array.isArray(x[n]) && !x[n].length)) return;
          p[n] = x[n];
        });
      }
      return p;
    }
    function csvFeld(v, typ){
      if (v == null) return '""';
      if (typ === "bool") v = v === true || v === "true" ? "Yes" : (v === false || v === "false" ? "No" : v);
      else if (typeof v === "object") v = JSON.stringify(v);
      return '"' + String(v).replace(/"/g, '""') + '"';
    }
    function csvBauen(spalten, zeilen){
      var kopf = spalten.map(function(c){ return csvFeld(c.header, "text"); }).join(",");
      var rumpf = zeilen.map(function(z){
        return spalten.map(function(c){ return csvFeld(z ? z[c.key] : null, c.type); }).join(",");
      });
      /* BOM: ohne ihn liest Excel die Datei als Windows-1252, und jeder Umlaut zerfaellt. */
      return "\uFEFF" + [kopf].concat(rumpf).join("\r\n");
    }
    function herunterladen(text, name){
      var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = name; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    }
    function exportSatz(erg){
      var m = erg && erg.fehler ? String(erg.fehler.message || "") : "";
      if (/rate_limited/.test(m) || (erg && erg.status === 429)) return ["Too many exports in a short time", "Please wait a minute and try again."];
      if (/team_access/.test(m) || (erg && erg.status === 402)) return ["Exports are not available for this team", "Check your plan in Billing."];
      if (/forbidden|role_required/.test(m) || (erg && erg.status === 403)) return ["You can't export this team's data", "Ask a team owner for access."];
      if (/invalid_param|invalid_date/.test(m)) return ["This date range can't be exported", "Choose a shorter range and try again."];
      return ["The export didn't work", "Please try again."];
    }
    /* Ganze Saetze durch den Katalog, die Zahl erst danach ({n}) -- zusammengesetzt kam im
       deutschen UI Englisch heraus. */
    function meldenToast(text, art, desc, n){
      var k = window.UpstreemCore, tr = k && k.t ? k.t : function(x){ return x; };
      var z = function(x){ return String(tr(x)).replace("{n}", String(n)); };
      if (k && k.toast) k.toast(z(text), { kind: art, desc: desc ? z(desc) : "" });
    }
    /* true: die Komponente exportiert selbst. false: Bubble-Weg. */
    function exportSelbst(){
      var art = state.type, cfg = EXPORTE[art], k = kern();
      if (!cfg || !k || (!cfg.neu && BUBBLE_TYP[art])) return false;
      var team = k.getTeam(), zeilen = [], seiten = 0, spalten = null;
      /* neu (Shopping, Ads): was pruefen schon weiss, gilt; fehlt der Export, steht der Satz im
         Dialog statt eines Fehlers. Einen Bubble-Weg gibt es fuer diese Typen nicht. */
      var da = daVon(art);
      setProcessing(true);
      function fertig(){ setProcessing(false); }
      function scheitern(erg){
        var s = exportSatz(erg);
        fertig();
        meldenToast(s[0], "error", s[1]);
      }
      function auchBubble(){ BUBBLE_TYP[art] = true; fertig(); fireExportBubble(); }
      function fehlt(){ da.stand = false; fertig(); daGeaendert(); }
      if (da && da.stand === true && da.spalten){ spalten = da.spalten; seite(0); return true; }
      k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
        if (da && exportFehlt(erg)) { fehlt(); return; }
        if (!da && ohneRpc(erg)) { auchBubble(); return; }
        var r = spaltenAus(erg);
        if (!r) { scheitern(erg); return; }
        if (da){ da.stand = true; da.spalten = r; }
        spalten = r;
        seite(0);
      }, scheitern);
      function seite(offset){
        if (!state.processing) return;            /* Dialog geschlossen: abgebrochen */
        k.rpc(cfg.fn, exportParameter(art, team, offset, cfg.seite), { timeoutMs: 120000 }).then(function(erg){
          if (da && exportFehlt(erg)) { fehlt(); return; }
          if (!da && ohneRpc(erg)) { auchBubble(); return; }
          var d = erg && erg.ok ? erg.daten : null;
          if (!d || !Array.isArray(d.rows)) { scheitern(erg); return; }
          zeilen = zeilen.concat(d.rows);
          seiten++;
          var m = d.meta || {};
          if (m.has_more === true && seiten < MAX_SEITEN && d.rows.length){
            seite(Number(m.offset || offset) + Number(m.limit || cfg.seite));
            return;
          }
          var typName = cfg.datei || (typVon(art) || { label: art }).label;
          var name = "upstreem-" + typName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + isoDate(state.from) + "-" + isoDate(state.to) + ".csv";
          herunterladen(csvBauen(spalten, zeilen), name);
          setProcessing(false);
          closePopup();
          var desc = m.has_more === true ? "The export was cut at {n} rows. Choose a shorter range for the rest." : "";
          meldenToast(zeilen.length === 1 ? "1 row exported" : "{n} rows exported", m.has_more === true ? "neutral" : "success", desc, zeilen.length);
        }, scheitern);
      }
      return true;
    }
    function fireExport(){
      if (state.processing) return;   // already sent, ignore a repeat click
      if (gesperrt(state.type)) return;
      if (exportSelbst()) return;
      /* Shopping und Ads gibt es nur in der App: ohne core oder Team kein Bubble-Weg, sondern ein Satz. */
      if (EXPORTE[state.type] && EXPORTE[state.type].neu){ meldenToast("The export didn't work", "error", "Please try again."); return; }
      fireExportBubble();
    }
    function fireExportBubble(){
      if (state.processing) return;
      var fnName = root.getAttribute("data-export-fn") || "bubble_fn_upstreemExport";
      var fn = resolveBubbleFn(fnName);
      /* KEIN Rueckfall auf einen anderen Namen. Ich hatte einen eingebaut, als der Name mit
         Suffix nicht gefunden wurde -- und damit ging der Aufruf still an ein gleichnamiges
         Element ohne Workflow. Der Export tat nichts, ohne eine einzige Meldung, und die
         Ursache war unter dem Rueckfall begraben.
         Wird der konfigurierte Name nicht gefunden, ist das ein Fehler und gehoert gemeldet --
         so wie in jeder anderen Komponente hier auch. */
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
        token: String(state.token == null ? "" : state.token),
        /* Leer heisst: kein Filter (Bubble setzt dann p_url / p_domain auf null). */
        url: String(state.url || ""),
        domain: String(state.domain || ""),
        prompt_id: String(state.promptId || ""),
        /* Marken-Drawer (12.10.): Bubble reicht es als p_brand an export_responses_v1,
           export_citations_domains_v1 und export_citations_urls_v1 weiter; leer heisst null. */
        brand_id: String(state.brandId || "")
      };
      var payloadJson;
      try { payloadJson = JSON.stringify(payload); } catch(e){ payloadJson = ""; }
      if (typeof fn === "function"){
        try { fn(payloadJson); } catch(e){}
      } else {
        /* NIEMAND EMPFAENGT (14.10.): bis hierher drehte der Knopf 90 s und ging dann still zurueck --
           in der App, wo es keinen Bubble-Workflow gibt, bei jedem Export, der hierher fiel. Jetzt
           sofort ein Satz, und der Dialog bleibt offen. */
        meldenToast("The export didn't work", "error", "Please try again.");
        // Visible on purpose: silently doing nothing here is exactly what made this look like
        // "clicking Export just closes the popup and nothing happens" — the dialog used to close
        // unconditionally regardless of whether Bubble ever received anything. Check that a
        // Toolbox "Javascript to Bubble" element exposes exactly this name.
        /* Knapp und ohne Namensliste. Die Liste war eine Diagnosehilfe fuer eine Runde und
           haette sonst bei jedem Fehlversuch zweihundert Namen in die Konsole geschrieben.
           Die Meldung selbst bleibt: ein Export, der stumm nichts tut, ist der schlimmere Fall.
           Haeufigste Ursache, gemessen: das Element ist unsichtbar -- Bubble veroeffentlicht
           bubble_fn_* nur fuer sichtbare Elemente. In der App (ohneBubble) gibt es kein solches
           Element -- dort sagt es der Satz oben, die Konsole bleibt still. */
        var kk = window.UpstreemCore;
        if (!(kk && kk.ohneBubble && kk.ohneBubble())) console.warn("[upstreem-export] " + fnName + " nicht gefunden. Ist das " +
          "JavaScriptToBubble-Element auf dieser Seite SICHTBAR? Unsichtbare Elemente " +
          "veroeffentlichen ihre Funktion nicht.");
      }
      try {
        root.dispatchEvent(new CustomEvent("upstreem-export", { detail: payload, bubbles: true }));
      } catch(e){}
      if (typeof fn === "function") setProcessing(true);
    }

    /* ---------------- listeners ---------------- */
    /* Nur wenn es einen gibt -- siehe oben. */
    if (btn) btn.addEventListener("click", function(e){ e.preventDefault(); e.stopPropagation(); openPopup(); });

    overlay.addEventListener("click", function(e){
      if (state.processing) return;   // locked until window.upstreemExportResolve() is called
      // click on the backdrop (not inside the dialog) closes
      if (!elDialog.contains(e.target)){ closePopup(); return; }
      var typeBtn = e.target.closest("[data-type]");
      if (typeBtn){ typSetzen(typeBtn.getAttribute("data-type")); pruefen(); persist(); renderAll(); return; }
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

    /* Eine Antwort von pruefen (oder ein fehlender Export beim Klick) zeichnet den offenen Dialog
       neu -- auch wenn ein anderer Controller gefragt hat. */
    window.addEventListener("uex-verfuegbar", function(){ if (state.open) renderAll(); });

    new MutationObserver(syncTheme).observe(root, {
      attributes: true, attributeFilter: ["data-isdark"]
    });
    // reconcile once right after attaching: the value may have resolved between the initial
    // read above and this observer existing, and that change would otherwise be lost
    syncTheme();

    new MutationObserver(function(){
      var t = normType(root.getAttribute("data-export-type"));
      if (t && t !== state.type){ typSetzen(t); persist(); renderAll(); }
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
        /* Auch TEXT annehmen. Ohne das musste der Run-JS-Schritt ein Objektliteral von Hand
           bauen -- und ein leerer Bubble-Ausdruck darin ("export_accesstoken": ,) toetet den
           ganzen Schritt beim PARSEN, samt aller Aufrufe darunter (§46). Mit einem einzigen
           Backtick ist derselbe leere Wert nur Text. */
        /* window.UpstreemCore direkt, KEINE UC-Variable: diese Datei kommt ohne core aus (siehe
           den Kommentar an dunkelJetzt), und ein `UC.` hier warf "UC is not defined" -- gemessen,
           bevor es jemand in Bubble gemerkt haette. Ohne core faellt es auf JSON.parse zurueck. */
        if (typeof opts === "string"){
          var C = window.UpstreemCore;
          if (C && C.readBubble) opts = C.readBubble(opts);
          else { try { opts = JSON.parse(opts); } catch (e){ opts = null; } }
        }
        opts = opts || {};
        var t = normType(opts.export_type != null ? opts.export_type : opts.type);
        if (t) typSetzen(t);
        var tok = (opts.export_accesstoken != null) ? opts.export_accesstoken : opts.token;
        if (tok != null) state.token = String(tok);
        /* EIN FILTER AUF EINE ADRESSE ODER DOMAIN (12.10., URL-Drawer: export_responses_v1 kennt
           p_url und p_domain). Bei JEDEM setContext neu gesetzt, auch auf leer -- und beim Schliessen
           geleert (closePopup): ein Export, der spaeter von einer Seite ohne Filter aufgeht, darf
           nicht die Adresse des Drawers mitnehmen. Nicht im Speicher (persist): ein Filter ist
           Kontext, keine Einstellung. */
        state.url = opts.url != null ? String(opts.url) : "";
        state.domain = opts.domain != null ? String(opts.domain) : "";
        state.promptId = opts.prompt_id != null ? String(opts.prompt_id) : "";
        state.brandId = opts.brand_id != null ? String(opts.brand_id) : "";
        /* SHOPPING UND ADS (16.10.): params je Typ der Gruppe (die Filter der Seite in den Namen der
           Liste), filter_aktiv je Typ (ob die Zusammenfassung "Current page filters apply." sagt)
           und der Zeitraum der Seite als Vorgabe. Bei jedem Aufruf neu gesetzt, auch auf leer, und
           beim Schliessen geleert (closePopup) -- ein Kontext gilt fuer DIESEN Export. */
        state.params = {}; state.filterAktiv = {};
        var pr = opts.params && typeof opts.params === "object" ? opts.params : {};
        Object.keys(pr).forEach(function(n){
          if (gruppeVon(n) && pr[n] && typeof pr[n] === "object" && !Array.isArray(pr[n])) state.params[n] = pr[n];
        });
        var fa = opts.filter_aktiv && typeof opts.filter_aktiv === "object" ? opts.filter_aktiv : {};
        Object.keys(fa).forEach(function(n){ if (typVon(n)) state.filterAktiv[n] = fa[n] === true; });
        /* Ein Preset der Seite ist dasselbe Preset hier (gleiche Schluessel wie der Kalender); ein
           freier Zeitraum wird beim Oeffnen in den Picker gegeben (syncCalendarToState). */
        var zf = parseIso(opts.date_from), zt = parseIso(opts.date_to);
        if (zf && zt && zf.getTime() <= zt.getTime()){
          var pk = String(opts.preset == null ? "" : opts.preset);
          var istPreset = PRESETS.some(function(x){ return x.key === pk; });
          state.preset = istPreset ? pk : "custom";
          state.from = zf; state.to = zt;
          state.zeitVonSeite = !istPreset;
        }
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
  /* Gebuendelt auf einen Lauf je 250ms und danach takeRecords -- derselbe Umbau, den der
     Icon-Stempel in core schon hinter sich hat. Ungebuendelt lief initAll() (mit einem
     dokumentweiten querySelectorAll) bei JEDER Mutation irgendwo auf der Seite: die
     Chart-Tooltips schreiben bei jeder Mausbewegung ihr innerHTML neu, also lief diese Suche
     mehrmals pro Mausbewegung mit. Ein spaet eingehaengtes Element wird 250ms spaeter gefunden,
     und das faellt niemandem auf -- die Suche im Animationsfenster fiel auf. */
  var uexGeplant = false;
  var uexObs = new MutationObserver(function(muts){
    if (uexGeplant) return;
    for (var i = 0; i < muts.length; i++){
      if (muts[i].addedNodes && muts[i].addedNodes.length){
        uexGeplant = true;
        setTimeout(function(){
          uexGeplant = false;
          initAll();
          try { uexObs.takeRecords(); } catch(e){}
        }, 250);
        return;
      }
    }
  });
  uexObs.observe(document.documentElement, { childList: true, subtree: true });
})();
