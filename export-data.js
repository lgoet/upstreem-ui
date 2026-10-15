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
    /* Kein Kachelname mehr (Variante D): die Liste unter "Data" hat Platz fuer den ganzen Namen. */
    { value: "ads_prompts",      label: "Prompts with Ads", gruppe: "ads" }
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
      "Advertisers": "Werbetreibende", "Ad Library": "Anzeigenbibliothek",
      "Prompts with Ads": "Prompts mit Ads", "Appearances": "Auftritte",
      /* Variante D (16.10.). "Edit" und "Done", "Columns", "Date range", "Custom range" und die
         Saetze der Fehler stehen schon in core und werden hier NICHT eingetragen. "Change" (wie
         auf der Leinwand) geht nicht: events.js und shopping.js fuehren es als Hauptwort
         ("Veraenderung"), der Katalog ist app-weit. */
      "Export {typ}": "{typ} exportieren",
      "From {quelle}": "Aus {quelle}",
      "From {quelle}, filtered to": "Aus {quelle}, gefiltert auf",
      "From {quelle}, with": "Aus {quelle}, mit",
      "Remove filter {name}": "Filter {name} entfernen",
      "Page filters": "Filter der Seite",
      "This prompt": "Dieser Prompt", "This brand": "Diese Marke",
      "Data": "Daten",
      "All columns": "Alle Spalten", "{n} columns": "{n} Spalten",
      "{k} of {n} columns": "{k} von {n} Spalten", "No columns": "Keine Spalten",
      "Choose at least one column.": "Wähl mindestens eine Spalte.",
      "Pick dates": "Tage wählen",
      "Safe to open in Excel and Sheets. Up to {n} rows.": "Sicher in Excel und Sheets zu öffnen. Bis zu {n} Zeilen.",
      "rows": "Zeilen", "of {n} rows": "von {n} Zeilen",
      "Export progress": "Fortschritt des Exports",
      "Page {k} of {n}. Closing this window stops the export.": "Seite {k} von {n}. Wenn du das Fenster schließt, bricht der Export ab.",
      "Page {k}. Closing this window stops the export.": "Seite {k}. Wenn du das Fenster schließt, bricht der Export ab.",
      "Cancel export": "Export abbrechen",
      "Download again": "Erneut herunterladen"
    });
  }
  function tr(x){ var C = window.UpstreemCore; return C && C.t ? C.t(x) : x; }
  /* Variante D (16.10.): der Kopf sagt, WOHER der Export kommt -- der Bereich der App, zu dem der
     Datensatz gehoert (Vorbild Vercel Logs: exportiert wird, was man gerade sieht). */
  var QUELLE = { prompts: "Prompt Insights", prompt_runs: "Prompt Insights", domains: "Citations",
                 urls: "Citations", brands: "Brands", shopping: "Shopping", ads: "Ads" };
  function quelleVon(v){ return QUELLE[gruppeVon(v) || v] || ""; }
  /* Welcher Filter eines Drawers fuer welchen Datensatz gilt -- genau die Liste aus
     exportParameter. Der Chip im Kopf steht nur, wo der Filter wirklich mitgeht: der Domain-Filter
     des Domain-Drawers gilt fuer URLs und Responses, nicht fuer Prompts. Vorher ging er bei einem
     Wechsel auf Prompts still verloren, und nichts im Dialog sagte das. */
  var FILTER = [
    { feld: "url",      typen: ["prompt_runs"],                    icon: "link" },
    { feld: "domain",   typen: ["prompt_runs", "urls"],            icon: "domain" },
    { feld: "promptId", typen: ["prompt_runs"],                    icon: "zap",         ersatz: "This prompt" },
    { feld: "brandId",  typen: ["prompt_runs", "domains", "urls"], icon: "squareStack", ersatz: "This brand" }
  ];
  /* Zeichen aus core (Hugeicons). Ohne core gibt es keins -- diese Datei kommt ohne core aus, und
     ein Knopf ohne Zeichen ist besser als ein selbst gezeichnetes. */
  function ic(name){ var C = window.UpstreemCore; return C && C.icon ? C.icon(name, 2) : ""; }
  /* Keys are deliberately the SAME strings the date range picker uses for its own presets,
     so syncing the two is a straight pass-through with nothing to translate. */
  var PRESETS = [
    { key: "last7",  label: "Last 7 Days",   days: 7  },
    { key: "last30", label: "Last 30 Days",  days: 30 },
    { key: "last3",  label: "Last 3 Months", months: 3 },
    { key: "last6",  label: "Last 6 Months", months: 6 }
  ];

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
      params: {}, filterAktiv: {}, zeitVonSeite: false,
      /* VARIANTE D (16.10.). phase: "wahl" (die Liste der Wahlen), "laeuft" (der Export blaettert)
         oder "fertig" (Datei heruntergeladen). offen: die aufgeklappte Zeile ("daten", "zeit",
         "spalten" oder ""). lauf: Zaehler des laufenden Exports, ergebnis: die fertige Datei
         fuer "Download again". fehler: der rote Satz unter der Liste. filterLabel: der Name zum
         Filter eines Drawers (Marke, Prompt), damit der Chip im Kopf ihn nennen kann.
         ohne: je Spaltensatz die abgewaehlten Spalten -- eine Einstellung, also im Speicher. */
      phase: "wahl", offen: "", lauf: null, ergebnis: null, fehler: "", filterLabel: "",
      ohne: (saved.ohne && typeof saved.ohne === "object") ? saved.ohne : {}
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
        from: isoDate(state.from), to: isoDate(state.to), ohne: state.ohne
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
    /* VARIANTE D "Schnellweg aus dem Kontext" (16.10., vom Nutzer gewaehlt). Vorbilder: Vercel Logs
       (exportiert, was man gerade sieht), Airtable und Attio (die Ansicht ist der Export), Ahrefs
       (Zeilengrenze vorab genannt). Der Dialog oeffnet vorbelegt -- Datensatz der Seite, Filter
       des Drawers, Zeitraum --, und ein Klick genuegt. Jede Wahl ist eine Zeile mit "Edit", die im
       Dialog aufklappt.
       DAS GERUEST STEHT EINMAL, gezeichnet wird nur hinein (zeichnen). Ein innerHTML ueber den
       ganzen Inhalt bei jedem Klick haette zweierlei gekostet: den Fokus (wer mit der Tastatur
       einen Zeitraum waehlt, stuende danach im Nichts) und den Kalender, dessen Knoten hier lebt
       und seinen Zustand behalten muss. */
    var titelId = "uex-titel-" + String(instanceId).replace(/[^a-z0-9_-]/gi, "") + "-" + Math.random().toString(36).slice(2, 7);
    function zeileHtml(k){
      return '<div class="uex-zeile" data-zeile="' + k + '">' +
        '<button class="uex-kopf" type="button" data-uex-zeile="' + k + '" aria-expanded="false" aria-controls="' + titelId + "-" + k + '">' +
          '<span class="uex-k-label"></span>' +
          '<span class="uex-k-mitte"><span class="uex-k-wert"></span><span class="uex-k-sub"></span></span>' +
          '<span class="uex-k-aktion"></span>' +
        '</button>' +
        '<div class="uex-auf" id="' + titelId + "-" + k + '" hidden>' +
          (k === "zeit"
            ? '<div class="uex-optionen" role="radiogroup">' +
                '<div class="uex-presets"></div>' +
                /* Der Kalender aus filters/date-range.js. Er kann nicht im Dialog aufklappen (kein
                   eingebetteter Modus, gemessen 16.10.): sein Feld ist ein Dropdown, das core in die
                   oberste Ebene hebt. Also oeffnet "Custom range" genau dieses Feld unter der Zeile --
                   die naechste Loesung aus core, nichts nachgebaut. */
                '<div class="uex-custom-wrap">' +
                  '<button class="up-pop-opt uex-opt uex-custom-btn" type="button" role="radio" aria-checked="false" tabindex="-1">' +
                    '<span class="up-pop-opt-l"><span class="uex-opt-label"></span></span>' +
                    '<span class="uex-opt-sub uex-custom-sub"></span>' +
                    '<span class="up-check" aria-hidden="true"></span>' +
                  '</button>' +
                  '<div class="uex-cal-slot"></div>' +
                '</div>' +
              '</div>'
            : '') +
        '</div>' +
      '</div>';
    }
    overlay.innerHTML =
      '<div class="up-topicmodal-card uex-dialog" role="dialog" aria-modal="true" aria-labelledby="' + titelId + '" data-phase="wahl">' +
        '<div class="up-topicmodal-head uex-head">' +
          '<div class="up-topicmodal-heading uex-heading">' +
            '<h2 class="up-topicmodal-title uex-titel" id="' + titelId + '"></h2>' +
            '<div class="uex-kontext"></div>' +
          '</div>' +
          /* .up-popup-close ist der Knopf JEDES Popups: kein Rahmen, Hover nur Flaeche und
             Primaerfarbe. Der eigene hatte einen Rahmen, der erst beim Ueberfahren erschien --
             der Knopf sprang und sah aus wie nirgends sonst in der App. */
          '<button class="up-popup-close uex-close" type="button">' + (ic("x") || "&times;") + '</button>' +
        '</div>' +
        '<div class="uex-body">' +
          '<div class="uex-wahl">' +
            '<div class="uex-liste">' +
              zeileHtml("daten") + zeileHtml("zeit") + zeileHtml("spalten") +
              /* Format hat keine Wahl: es gibt nur CSV. Eine Zeile mit "Edit", hinter der eine
                 einzige Moeglichkeit steht, waere ein toter Klick -- also steht sie fest da. */
              '<div class="uex-zeile is-fest" data-zeile="format">' +
                '<div class="uex-kopf is-fest">' +
                  '<span class="uex-k-label"></span>' +
                  '<span class="uex-k-mitte"><span class="uex-k-wert">CSV</span><span class="uex-k-sub"></span></span>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="up-fehlerzeile uex-fehler" role="alert"><span></span></div>' +
            '<div class="uex-hinweis"></div>' +
          '</div>' +
          '<div class="uex-lauf" hidden>' +
            '<div class="uex-zahl"><span class="uex-zahl-n"></span><span class="uex-zahl-von"></span></div>' +
            '<div class="uex-balken" role="progressbar" aria-valuemin="0"><div class="uex-balken-f"></div></div>' +
            '<p class="uex-satz uex-lauf-satz" aria-live="polite"></p>' +
          '</div>' +
          '<div class="uex-fertig" hidden>' +
            '<div class="uex-fertig-kopf">' + ic("checkCircle") + '<span class="uex-fertig-titel"></span></div>' +
            '<div class="uex-datei">' + ic("fileText") + '<span class="uex-datei-name"></span><span class="uex-datei-groesse"></span></div>' +
            '<p class="uex-satz uex-fertig-satz" hidden></p>' +
          '</div>' +
        '</div>' +
        '<div class="uex-foot">' +
          /* Zwei Knoepfe aus core in der grossen Stufe (40). Der zweite traegt je nach Phase
             "Cancel export" (mit dem Kreisel aus core) oder "Download again". */
          '<button class="up-btn-sec is-lg uex-zweit" type="button" hidden><span class="up-btn-spin" aria-hidden="true"></span><span class="uex-zweit-ic"></span><span class="uex-zweit-text"></span></button>' +
          '<button class="up-btn-pri is-lg uex-submit" type="button"><span class="uex-submit-icon"></span><span class="uex-submit-text"></span></button>' +
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

    function q(sel){ return overlay.querySelector(sel); }
    var elDialog  = q(".uex-dialog");
    var elBody    = q(".uex-body");
    var elTitel   = q(".uex-titel");
    var elKontext = q(".uex-kontext");
    var elClose   = q(".uex-close");
    var elWahl    = q(".uex-wahl");
    var elLauf    = q(".uex-lauf");
    var elFertig  = q(".uex-fertig");
    var elFehler  = q(".uex-fehler");
    var elHinweis = q(".uex-hinweis");
    var elPresets = q(".uex-presets");
    var elCustomBtn = q(".uex-custom-btn");
    var elCustomSub = q(".uex-custom-sub");
    var elCustomWrap = q(".uex-custom-wrap");
    var elCalSlot = q(".uex-cal-slot");
    var elFoot    = q(".uex-foot");
    var elZweit   = q(".uex-zweit");
    var elSubmit  = q(".uex-submit");
    var elSubmitIcon = q(".uex-submit-icon");
    var elSubmitText = q(".uex-submit-text");
    var SPINNER_SVG = '<span class="uex-spin" aria-hidden="true"></span>';

    function syncTheme(){
      var dark = dunkelJetzt(root.getAttribute("data-isdark"));
      isDark = dark;
      if (dark){ root.setAttribute("data-theme","dark"); overlay.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); overlay.removeAttribute("data-theme"); }
    }

    /* ---------------- zeichnen ----------------
       Hilfen: setzen() schreibt nur, wenn sich etwas aendert -- sonst verloere ein fokussierter
       Knopf in einer Liste bei jedem Neuzeichnen seinen Fokus. */
    function setzen(el, html){ if (el && el.__uexHtml !== html){ el.__uexHtml = html; el.innerHTML = html; } }
    function text(el, s){ if (el && el.textContent !== s) el.textContent = s; }
    function zahl(n){ var C = window.UpstreemCore; return C && C.fmtInt ? C.fmtInt(n) : String(n); }
    function datum(d){
      var C = window.UpstreemCore;
      /* Das Datumsformat des Nutzers (UC.fmtDate). Als lokaler Zeitpunkt, nicht als "2026-07-15":
         den liest Date als UTC-Mitternacht, und westlich von UTC stuende der Vortag da. */
      return C && C.fmtDate ? C.fmtDate(isoDate(d) + "T00:00:00") : prettyDate(d);
    }
    /* Zeitraum wie im Styleguide (1c): beide Enden im App-Format, Halbgeviertstrich dazwischen. */
    function spanne(f, t){ return datum(f) + " – " + datum(t); }
    function presetSpanne(p){
      var t = startOfDay(new Date());
      return spanne(p.days ? addDays(t, -(p.days - 1)) : addMonths(t, -p.months), t);
    }
    function groesse(b){
      var C = window.UpstreemCore, f = C && C.fmtNum ? function(v, n){ return C.fmtNum(v, n); } : function(v, n){ return v.toFixed(n); };
      if (b < 1024) return b + " B";
      if (b < 1048576) return f(b / 1024, b < 10240 ? 1 : 0) + " KB";
      return f(b / 1048576, 1) + " MB";
    }
    function optHtml(attr, wert, label){
      return '<button class="up-pop-opt uex-opt" type="button" role="radio" aria-checked="false" tabindex="-1" ' + attr + '="' + esc(wert) + '">' +
        '<span class="up-pop-opt-l"><span class="uex-opt-label">' + esc(label) + '</span></span>' +
        '<span class="uex-opt-sub"></span>' +
        '<span class="up-check" aria-hidden="true">' + ic("check") + '</span></button>';
    }
    /* Roving tabindex in einer Radiogruppe: nur die gewaehlte Zeile ist ein Tab-Halt, die Pfeile
       wandern (Tastatur unten). */
    function radioStand(btn, an){
      btn.classList.toggle("is-active", an);
      btn.setAttribute("aria-checked", an ? "true" : "false");
      btn.setAttribute("tabindex", an ? "0" : "-1");
    }

    function selbstMoeglich(art){
      var cfg = EXPORTE[art];
      return !!(cfg && kern() && (cfg.neu || !BUBBLE_TYP[art]));
    }
    function gewaehlteSpalten(art){
      var e = spaltenVon(art), cfg = EXPORTE[art];
      if (!e || !e.spalten || !cfg) return null;
      var aus = state.ohne[cfg.spalten] || {};
      return e.spalten.filter(function(c){ return !aus[c.key]; });
    }
    function keineSpalten(){
      if (!selbstMoeglich(state.type)) return false;
      var g = gewaehlteSpalten(state.type);
      return !!g && g.length === 0;
    }
    function kurzUrl(u){ return String(u).replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""); }

    function kontextZeichnen(art){
      var chips = [];
      /* Das Kreuz nur, solange gewaehlt wird -- im Lauf und danach aendert es nichts mehr. */
      var wahl = state.phase === "wahl";
      FILTER.forEach(function(f){
        var v = state[f.feld];
        if (!v || f.typen.indexOf(art) < 0) return;
        var label = f.feld === "url" ? kurzUrl(v) : (f.feld === "domain" ? String(v) : (state.filterLabel || tr(f.ersatz)));
        chips.push('<span class="up-entchip is-static uex-chip' + (wahl ? "" : " is-fest") + '" title="' + esc(label) + '">' +
          '<span class="uex-chip-ic">' + ic(f.icon) + '</span><span class="uex-chip-lbl">' + esc(label) + '</span>' +
          (wahl ? '<button class="up-iconbtn is-20 uex-chip-x" type="button" data-uex-filterweg="' + f.feld + '" aria-label="' +
            esc(tr("Remove filter {name}").replace("{name}", label)) + '">' + ic("x") + '</button>' : '') + '</span>');
      });
      /* Shopping und Ads geben die Filter der Seite als Parameter mit (setContext params). Die
         lassen sich hier nicht einzeln abwaehlen -- sie stehen in der Leiste der Seite --, also
         ein Chip ohne Kreuz: er sagt, dass sie gelten. */
      if (state.filterAktiv[art]) chips.push('<span class="up-entchip is-static uex-chip is-fest">' +
        '<span class="uex-chip-ic">' + ic("listFilter") + '</span><span class="uex-chip-lbl">' + esc(tr("Page filters")) + '</span></span>');
      var qn = quelleVon(art);
      if (!qn){ setzen(elKontext, ""); return; }
      /* "filtered to adac.de", aber "with Page filters" -- "filtered to Page filters" las sich doppelt. */
      var nurSeite = chips.length === 1 && state.filterAktiv[art];
      var satz = (!chips.length ? tr("From {quelle}") : (nurSeite ? tr("From {quelle}, with") : tr("From {quelle}, filtered to"))).replace("{quelle}", tr(qn));
      setzen(elKontext, '<span class="uex-kontext-satz">' + esc(satz) + '</span>' + chips.join(""));
    }

    function zeileKopf(k, label, wert, sub, editierbar){
      var z = q('.uex-zeile[data-zeile="' + k + '"]');
      if (!z) return;
      var offen = editierbar && state.offen === k;
      z.classList.toggle("is-offen", offen);
      text(z.querySelector(".uex-k-label"), label);
      text(z.querySelector(".uex-k-wert"), wert);
      var s = z.querySelector(".uex-k-sub");
      text(s, sub || "");
      if (s) s.title = sub || "";
      var kopf = z.querySelector(".uex-kopf");
      var akt = z.querySelector(".uex-k-aktion");
      if (akt) text(akt, editierbar ? tr(offen ? "Done" : "Edit") : "");
      if (kopf && kopf.tagName === "BUTTON"){
        kopf.disabled = !editierbar;
        kopf.setAttribute("aria-expanded", offen ? "true" : "false");
      }
      var auf = z.querySelector(".uex-auf");
      if (auf) auf.hidden = !offen;
    }

    function datenZeichnen(art){
      var g = gruppeVon(art);
      var typen = TYPES.filter(function(t){ return t.gruppe === g; });
      var label = typVon(art);
      zeileKopf("daten", tr("Data"), label ? tr(label.label) : art, "", typen.length > 1);
      var auf = q('.uex-zeile[data-zeile="daten"] .uex-auf');
      /* Nur neu bauen, wenn die Gruppe wechselt (Shopping, Ads, Grundgruppe); sonst nur den Stand. */
      setzen(auf, '<div class="uex-optionen" role="radiogroup" aria-label="' + esc(tr("Data")) + '">' +
        typen.map(function(t){ return optHtml("data-type", t.value, tr(t.label)); }).join("") + '</div>');
      [].forEach.call(auf.querySelectorAll("[data-type]"), function(b){ radioStand(b, b.getAttribute("data-type") === art); });
    }

    function zeitZeichnen(){
      var custom = state.preset === "custom";
      var p = PRESETS.filter(function(x){ return x.key === state.preset; })[0];
      zeileKopf("zeit", tr("Date range"), custom ? tr("Custom range") : tr(p ? p.label : "Custom range"), spanne(state.from, state.to), true);
      q('.uex-zeile[data-zeile="zeit"] .uex-optionen').setAttribute("aria-label", tr("Date range"));
      setzen(elPresets, PRESETS.map(function(x){ return optHtml("data-preset", x.key, tr(x.label)); }).join(""));
      [].forEach.call(elPresets.querySelectorAll("[data-preset]"), function(b){
        var x = PRESETS.filter(function(y){ return y.key === b.getAttribute("data-preset"); })[0];
        text(b.querySelector(".uex-opt-sub"), x ? presetSpanne(x) : "");
        radioStand(b, b.getAttribute("data-preset") === state.preset);
      });
      text(elCustomBtn.querySelector(".uex-opt-label"), tr("Custom range"));
      if (!elCustomBtn.querySelector(".up-check svg")) setzen(elCustomBtn.querySelector(".up-check"), ic("check"));
      /* Fehlt der Kalender (Loader ohne date-range.js), sagt es die Zeile selbst -- ein stumm
         ausgegrauter Knopf saehe aus wie eine Design-Entscheidung. */
      var weg = elCustomBtn.classList.contains("is-aus");
      text(elCustomSub, weg ? tr("Custom range is unavailable. Please reload the page.") : (custom ? spanne(state.from, state.to) : tr("Pick dates")));
      radioStand(elCustomBtn, custom);
    }

    function spaltenZeichnen(art){
      var cfg = EXPORTE[art], e = spaltenVon(art), sel = gewaehlteSpalten(art);
      var kann = selbstMoeglich(art) && !!sel;
      var n = kann ? e.spalten.length : 0, k = kann ? sel.length : 0;
      var wert = !kann || k === n ? tr("All columns") : (k === 0 ? tr("No columns")
        : tr("{k} of {n} columns").replace("{k}", zahl(k)).replace("{n}", zahl(n)));
      var sub = kann && k === n ? tr("{n} columns").replace("{n}", zahl(n)) : "";
      zeileKopf("spalten", tr("Columns"), wert, sub, kann);
      if (!kann){ if (state.offen === "spalten") state.offen = ""; return; }
      var auf = q('.uex-zeile[data-zeile="spalten"] .uex-auf');
      var aus = state.ohne[cfg.spalten] || {};
      /* Die Checkliste aus core (.up-filter-list/-item/-check), Kopfzeile mit "Select all", sobald
         etwas abgewaehlt ist. Gebaut je Spaltensatz, danach nur der Stand. */
      setzen(auf, '<div class="up-filter-head uex-spalten-kopf"><span class="uex-spalten-zahl"></span>' +
          '<button class="up-filter-reset uex-alle" type="button" data-uex-alle="1">' + esc(tr("Select all")) + '</button></div>' +
        '<div class="up-filter-list uex-spalten" role="group" aria-label="' + esc(tr("Columns")) + '">' +
        e.spalten.map(function(c){
          return '<button class="up-filter-item uex-spalte" type="button" role="checkbox" aria-checked="true" data-spalte="' + esc(c.key) + '">' +
            '<span class="up-filter-check">' + ic("check") + '</span><span class="uex-spalte-lbl">' + esc(tr(c.header || c.key)) + '</span></button>';
        }).join("") + '</div>');
      [].forEach.call(auf.querySelectorAll("[data-spalte]"), function(b){
        var an = !aus[b.getAttribute("data-spalte")];
        b.classList.toggle("is-checked", an);
        b.setAttribute("aria-checked", an ? "true" : "false");
      });
      var kopf = auf.querySelector(".uex-spalten-kopf");
      kopf.hidden = k === n;
      text(auf.querySelector(".uex-spalten-zahl"), tr("{k} of {n} columns").replace("{k}", zahl(k)).replace("{n}", zahl(n)));
    }

    function hinweisZeichnen(art){
      var cfg = EXPORTE[art];
      /* Fehlt der Export noch (Shopping, Ads), steht statt des Hinweises der Satz, und der
         Knopf ruht -- kein Fehler, kein Klick ins Leere. */
      var bald = baldSatz(art);
      elHinweis.classList.toggle("is-bald", !!bald);
      if (bald){ setzen(elHinweis, ic("clock") + '<span>' + esc(bald) + '</span>'); elHinweis.hidden = false; return; }
      if (keineSpalten()){ setzen(elHinweis, ic("info") + '<span>' + esc(tr("Choose at least one column.")) + '</span>'); elHinweis.hidden = false; return; }
      /* Steht ein Fehler da, steht er allein (Leinwand D): zwei Saetze untereinander lesen sich als
         einer, und der rote soll gelesen werden. */
      if (state.fehler){ setzen(elHinweis, ""); elHinweis.hidden = true; return; }
      /* Die Grenze vorab (Ahrefs): so viele Zeilen passen in einen Lauf -- Seitengroesse mal die
         60 Seiten, die die Datenbank je Minute erlaubt. Formelschutz macht die Datenbank
         (csv_safe_v1); beides gilt nur fuer den Weg ueber die App, nicht fuer Bubble. */
      if (cfg && selbstMoeglich(art)){
        setzen(elHinweis, ic("shieldCheck") + '<span>' + esc(tr("Safe to open in Excel and Sheets. Up to {n} rows.").replace("{n}", zahl(cfg.seite * MAX_SEITEN))) + '</span>');
        elHinweis.hidden = false; return;
      }
      setzen(elHinweis, ""); elHinweis.hidden = true;
    }

    function laufZeichnen(){
      var L = state.lauf;
      if (!L) return;
      var max = L.gesamt != null ? Math.min(L.gesamt, L.kappe) : null;
      text(q(".uex-zahl-n"), zahl(L.zeilen));
      text(q(".uex-zahl-von"), max != null ? tr("of {n} rows").replace("{n}", zahl(max)) : tr("rows"));
      var bar = q(".uex-balken");
      /* Der Balken zeigt nur echten Fortschritt (Zeilen von total_count). Kennt die Antwort keine
         Gesamtzahl, steht kein Balken da statt eines erfundenen -- vor der ersten Seite steht er
         leer, weil die Gesamtzahl mit ihr kommt. */
      var mitBalken = max != null || L.seiten === 0;
      bar.hidden = !mitBalken;
      bar.setAttribute("aria-label", tr("Export progress"));
      if (max != null){ bar.setAttribute("aria-valuemax", String(max)); bar.setAttribute("aria-valuenow", String(Math.min(L.zeilen, max))); }
      else { bar.removeAttribute("aria-valuemax"); bar.setAttribute("aria-valuenow", "0"); }
      q(".uex-balken-f").style.width = (max ? Math.min(100, L.zeilen / max * 100) : 0).toFixed(1) + "%";
      var seitenGesamt = max != null ? Math.max(1, Math.ceil(max / L.limit)) : null;
      var k = seitenGesamt ? Math.min(L.seiten + 1, seitenGesamt) : L.seiten + 1;
      text(q(".uex-lauf-satz"), (seitenGesamt ? tr("Page {k} of {n}. Closing this window stops the export.").replace("{n}", zahl(seitenGesamt))
        : tr("Page {k}. Closing this window stops the export.")).replace("{k}", zahl(k)));
    }

    function fertigZeichnen(){
      var E = state.ergebnis;
      if (!E) return;
      text(q(".uex-fertig-titel"), E.n === 1 ? tr("1 row exported") : tr("{n} rows exported").replace("{n}", zahl(E.n)));
      var nm = q(".uex-datei-name");
      text(nm, E.name); nm.title = E.name;
      /* Die Groesse ist die der Datei, die der Browser gerade gebaut hat (Blob.size) -- gemessen,
         nicht geschaetzt; die Datenbank liefert keine. */
      text(q(".uex-datei-groesse"), groesse(E.groesse));
      var s = q(".uex-fertig-satz");
      s.hidden = !E.gekappt;
      text(s, E.gekappt ? tr("The export was cut at {n} rows. Choose a shorter range for the rest.").replace("{n}", zahl(E.n)) : "");
    }

    function fussZeichnen(art){
      var label = typVon(art);
      var ph = state.phase;
      elFoot.classList.toggle("is-zwei", ph === "fertig");
      elZweit.hidden = ph === "wahl";
      elSubmit.hidden = ph === "laeuft";
      elZweit.classList.toggle("is-busy", ph === "laeuft");
      setzen(q(".uex-zweit-ic"), ph === "fertig" ? ic("download") : "");
      text(q(".uex-zweit-text"), ph === "laeuft" ? tr("Cancel export") : tr("Download again"));
      if (ph === "fertig"){
        setzen(elSubmitIcon, "");
        text(elSubmitText, tr("Done"));
        elSubmit.disabled = false;
        elSubmit.classList.remove("is-busy");
        return;
      }
      /* Der Bubble-Weg wartet auf upstreemExportResolve: Kreisel im Knopf wie bisher. */
      setzen(elSubmitIcon, state.processing ? SPINNER_SVG : ic("download"));
      text(elSubmitText, state.processing ? tr("Exporting…") : tr("Export {typ}").replace("{typ}", label ? tr(label.label) : art));
      elSubmit.classList.toggle("is-busy", !!state.processing);
      knopfStand();
    }

    function zeichnen(){
      var art = state.type, label = typVon(art);
      text(elTitel, tr("Export {typ}").replace("{typ}", label ? tr(label.label) : art));
      elClose.setAttribute("aria-label", tr("Close"));
      kontextZeichnen(art);
      elDialog.setAttribute("data-phase", state.phase);
      elWahl.hidden = state.phase !== "wahl";
      elLauf.hidden = state.phase !== "laeuft";
      elFertig.hidden = state.phase !== "fertig";
      elBody.classList.toggle("is-processing", !!state.processing);
      if (state.phase === "wahl"){
        datenZeichnen(art);
        zeitZeichnen();
        spaltenZeichnen(art);
        text(q('.uex-zeile[data-zeile="format"] .uex-k-label'), tr("Format"));
        hinweisZeichnen(art);
        elFehler.classList.toggle("is-on", !!state.fehler);
        text(elFehler.querySelector("span"), state.fehler || "");
      }
      if (state.phase === "laeuft") laufZeichnen();
      if (state.phase === "fertig") fertigZeichnen();
      fussZeichnen(art);
    }
    /* renderAll zeichnet den GANZEN Inhalt des Dialogs. Am Aufruf beim Oeffnen stand ein leerer
       Faenger ohne Rueckfall: warf hier etwas, ging der Dialog leer auf, und leer sah damit
       genauso aus wie kaputt. Jetzt sagt er, dass er sich nicht aufbauen liess, und was zu tun
       ist. Kein interner Name, kein Verweis auf die Konsole.
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
      try { zeichnen(); }
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
    /* Die Kennung des eigenen Pickers IST die Instanz-Kennung. Ein Praefix davor war unnoetig:
       date-range sucht nur unter .udr-root-Elementen, und das Export-Element traegt diese Klasse
       nicht -- eine Kollision ist damit ausgeschlossen. Gleiche Kennung heisst: in der Konsole
       steht der Name, den man auch im Editor sieht. data-calendar-id wird weiterhin gelesen --
       wer schon ein Element verdrahtet hat, behaelt es. */
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
    /* Die Wurzel des Kalenders schon beim Aufbau des Controllers anlegen, nicht erst beim Oeffnen
       (16.10. gemessen): date-range.js baut neue Wurzeln in seinem Takt (bis 1,5 s), und solange
       war "Custom range" direkt nach dem ersten Oeffnen ein toter Klick. Nur anlegen -- ob der
       Kalender fehlt, entscheidet weiter adoptCalendar beim Oeffnen. */
    function kalenderAnlegen(){
      var vorhanden = findCalendar();
      if (calBuilt || (vorhanden && vorhanden.parentNode !== elCalSlot)) return;
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
    function adoptCalendar(){
      var vorhanden = findCalendar();
      /* Liegt schon einer auf der Seite -- etwa weil data-calendar-id auf ein bestehendes Element
         zeigt -- wird der benutzt, aber NICHT verschoben. Verschieben war der Teil, der beim
         Zurueckschieben schiefgehen konnte. */
      if (vorhanden && vorhanden.parentNode !== elCalSlot){
        watchCalendarOpenState(); syncCalendarToState(); return;
      }
      kalenderAnlegen();
      /* KEIN resetUpstreemDateRangePicker mehr. Der Aufruf sollte den Aufbau anstossen, fand das
         Element aber nicht -- und jeder Fehlversuch schrieb eine lange Warnung in die Konsole.
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
      /* Still: der Custom-Bereich zeigt im Dialog selbst, ob er benutzbar ist. */
      catch(e){}
    }
    /* Zweiter Teil von adoptCalendar, aufgerufen sobald der Picker steht oder endgueltig fehlt. */
    function fertig(cal){
      if (!cal || !cal.__udrCtrl){
        /* date-range.js ist nicht geladen. Dann fehlt der Loader-Block, und das gehoert gesagt --
           in der Zeile selbst (zeitZeichnen), nicht als Dateiname: der Nutzer bekommt zu lesen,
           was er tun kann. Der Grund gehoert in die Konsole. */
        elCustomBtn.classList.add("is-aus");
        elCustomBtn.setAttribute("aria-disabled", "true");
        renderAll();
        if (window.console) console.error("upstreem export-data: filters/date-range.js fehlt im " +
          "Loader-Block dieses Elements, deshalb gibt es keinen Kalender.");
        return;
      }
      elCustomBtn.classList.remove("is-aus");
      elCustomBtn.removeAttribute("aria-disabled");
      watchCalendarOpenState();
      syncCalendarToState();
      renderAll();
    }
    /* The picker keeps aria-expanded on its trigger in sync with its panel, which makes it the
       cleanest signal for "the calendar is currently open" — no polling, no reaching into the
       picker's internals. Der unsichtbare Ausloeser ist kein Tab-Halt (tabindex -1): mit der
       Tastatur steht man auf der sichtbaren Zeile, und die oeffnet das Feld per Klick auf ihn.
       Geht das Feld zu und der Fokus stand auf dem unsichtbaren Ausloeser (der Picker gibt ihn
       dorthin zurueck), wandert er auf die sichtbare Zeile -- sonst stuende er im Unsichtbaren. */
    function watchCalendarOpenState(){
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (!trig || trig.__uexWatched) return;
      trig.__uexWatched = true;
      trig.setAttribute("tabindex", "-1");
      trig.setAttribute("aria-hidden", "true");
      var apply = function(){
        var auf = trig.getAttribute("aria-expanded") === "true";
        elCustomBtn.classList.toggle("is-cal-open", auf);
        if (!auf && document.activeElement === trig){ try { elCustomBtn.focus({ preventScroll: true }); } catch(e){} }
      };
      new MutationObserver(apply).observe(trig, { attributes: true, attributeFilter: ["aria-expanded"] });
      apply();
    }
    function kalenderOeffnen(){
      if (elCustomBtn.classList.contains("is-aus")) return;
      var trig = elCalSlot.querySelector(".udr-trigger");
      if (trig) try { trig.click(); } catch(e){}
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
    /* Beim Schliessen des Dialogs muss auch das Kalenderfeld zu. Ueber den Trigger, nicht ueber
       die Klassen: der Picker haelt seinen Zustand intern (setOpen), und ein von aussen entferntes
       is-open liesse ihn glauben, er sei noch offen -- der naechste Klick wuerde dann zumachen
       statt aufmachen. Sein Controller bietet kein close() an, der Trigger schaltet aber um, und
       aria-expanded sagt verlaesslich, ob das noetig ist. */
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
        /* Ein neuer Zeitraum ist eine neue Wahl -- der rote Satz zum alten ("zu lang") gilt nicht mehr. */
        state.fehler = "";
        persist(); renderAll();
      });
    }

    /* ---------------- open / close ---------------- */
    var lastFocus = null;
    function fokus(el){ try { if (el && !el.hidden && !el.disabled) { el.focus({ preventScroll: true }); return true; } } catch(e){} return false; }
    /* Nach jedem Phasenwechsel steht der Fokus auf dem Knopf, der jetzt zaehlt -- der alte ist
       dann oft verschwunden (Cancel export nach dem Ende), und Fokus im Nichts heisst: die
       naechste Taste geht an die Seite dahinter. */
    function fokusFuss(){ if (!fokus(elSubmit) && !fokus(elZweit)) fokus(elClose); }
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
      state.phase = "wahl"; state.offen = ""; state.fehler = ""; state.lauf = null; state.ergebnis = null;
      /* Der Kalender ist Beiwerk, das Oeffnen ist die Hauptsache. Wirft irgendetwas beim Anlegen
         oder Suchen des Pickers, kam der Dialog frueher gar nicht mehr hoch -- gemessen beim
         Nutzer: is-open blieb false, kein Inline-Stil, der Dialog unsichtbar da. Ein Fehler hier
         darf hoechstens den Custom-Bereich kosten, nie den ganzen Export. */
      try { adoptCalendar(); }
      /* Still, aus demselben Grund. Fehlt der Kalender, sagt es die Custom-Zeile. */
      catch(e){}
      pruefen();
      spaltenHolen(state.type);
      renderAll();
      lastFocus = document.activeElement;
      overlay.inert = false;
      overlay.setAttribute("aria-hidden", "false");
      /* is-shown ist der Zustand des Core-Popups, is-open bleibt fuer die eigenen Regeln. */
      overlay.classList.add("is-open", "is-shown");
      document.body.classList.add("uex-popup-open");   // lifts the picker's panel above us
      if (btn) btn.setAttribute("aria-expanded", "true");
      state.open = true;
      /* Ein Klick genuegt: der Fokus steht auf "Export ...", Enter exportiert. Ruht der Knopf
         (Shopping, Ads: kommt bald), steht er auf dem Schliessen-Knopf. */
      fokusFuss();
    }
    function closePopup(){
      if (!state.open) return;
      /* Der Filter des Drawers gilt nur fuer DIESEN Export (siehe setContext). */
      state.url = ""; state.domain = ""; state.promptId = ""; state.brandId = ""; state.filterLabel = "";
      /* Ebenso Kontext und Gruppe von Shopping und Ads: danach gilt wieder die Grundgruppe. */
      state.params = {}; state.filterAktiv = {}; state.zeitVonSeite = false;
      if (gruppeVon(state.type)) state.type = state.stammTyp;
      /* Schliessen bricht einen laufenden Export ab (das sagt der Satz unter dem Balken): die
         naechste Seite wird nicht mehr geholt, nichts heruntergeladen. */
      state.phase = "wahl"; state.offen = ""; state.fehler = ""; state.lauf = null; state.ergebnis = null;
      // never hide a focused element from assistive tech — move focus out FIRST
      if (overlay.contains(document.activeElement)){
        try {
          /* Zurueck auf den Ausloeser -- aber nur, wenn er ausserhalb liegt und fokussierbar ist.
             Kam das Oeffnen aus einem Skript (Fokus auf body) oder lag er selbst im Dialog, blieb
             der Fokus sonst auf einem Knopf im verdeckten Dialog stehen (gemessen 16.10.). */
          var ziel = lastFocus && lastFocus.isConnected && lastFocus !== document.body && !overlay.contains(lastFocus) ? lastFocus : btn;
          if (ziel) ziel.focus({ preventScroll: true });
          if (overlay.contains(document.activeElement)) document.activeElement.blur();
        } catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      overlay.classList.remove("is-open", "is-shown");
      overlay.setAttribute("aria-hidden", "true");
      overlay.inert = true;
      document.body.classList.remove("uex-popup-open");
      if (btn) btn.setAttribute("aria-expanded", "false");
      state.open = false;
      if (state.processing) setProcessing(false);   // defensive: don't leave a stale timer/state behind
      /* SOFORT, nicht verzoegert: das Panel soll mit dem Dialog verschwinden, nicht erst danach. */
      closeCalendar();
    }

    /* Der BUBBLE-Weg (fireExportBubble): der Dialog wartet auf upstreemExportResolve und ist so
       lange gesperrt -- schliessen kann ihn nur Bubble. Der Weg ueber die App laeuft dagegen in
       der Phase "laeuft" und laesst sich jederzeit abbrechen. */
    function setProcessing(on){
      state.processing = !!on;
      elClose.disabled = state.processing;
      renderAll();
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
    /* Der Eintrag je Spaltensatz, fuer JEDEN Typ (Variante D zeigt die Spalten in der Zeile
       "Columns"). daVon bleibt der Eintrag nur fuer die neuen Typen -- nur dort heisst ein
       fehlender Spaltensatz "kommt bald". */
    function spaltenVon(art){
      var cfg = EXPORTE ? EXPORTE[art] : null;
      if (!cfg) return null;
      return DA[cfg.spalten] || (DA[cfg.spalten] = { stand: null, spalten: null, laeuft: false });
    }
    function daVon(art){
      var cfg = EXPORTE ? EXPORTE[art] : null;
      if (!cfg || !cfg.neu) return null;
      return spaltenVon(art);
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
    /* Die Spalten eines Typs der Grundgruppe vorab, damit die Zeile "Columns" sie zeigen kann.
       Derselbe Aufruf, den der Export ohnehin als ersten macht -- er wird danach nicht wiederholt.
       Scheitert er, bleibt die Zeile bei "All columns" ohne Wahl, und der Export fragt selbst. */
    function spaltenHolen(art){
      var cfg = EXPORTE[art], e = spaltenVon(art), k = kern();
      if (!cfg || cfg.neu || !e || !k || e.stand !== null || e.laeuft || BUBBLE_TYP[art]) return;
      e.laeuft = true;
      function ende(){ e.laeuft = false; daGeaendert(); }
      k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
        var r = spaltenAus(erg);
        if (r){ e.stand = true; e.spalten = r; }
        ende();
      }, ende);
    }
    function gesperrt(art){ var e = daVon(art); return !!e && (e.stand === false || e.laeuft); }
    function baldSatz(art){
      var e = daVon(art), g = gruppeVon(art);
      if (!e || e.stand !== false) return "";
      var alle = TYPES.every(function(x){ var d = x.gruppe === g ? daVon(x.value) : null; return !d || d.stand === false; });
      return tr(alle && GRUPPEN[g] ? GRUPPEN[g].bald : "This export is coming soon.");
    }
    /* Der gesperrte Knopf ist der core-Knopf im disabled-Zustand (.up-btn-pri:disabled, 40 %),
       nicht mehr ein auf 70 % gedimmter -- der las sich fast wie aktiv. */
    function knopfStand(){ elSubmit.disabled = state.processing || gesperrt(state.type) || keineSpalten(); }
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
         den sie nicht hat, liesse PostgREST die Funktion gar nicht finden (PGRST202). Dieselbe
         Liste steht oben in FILTER (der Chip im Kopf). */
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
      return "﻿" + [kopf].concat(rumpf).join("\r\n");
    }
    /* Die Datei als Blob -- er bleibt fuer "Download again" stehen, bis der Dialog schliesst. Je
       Herunterladen eine eigene Objekt-Adresse, nach 4 s wieder freigegeben. */
    function herunterladen(blob, name){
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
    /* Variante D: Fehler stehen als roter Satz im Dialog (.up-fehlerzeile), nicht mehr als Toast --
       der Dialog bleibt offen, die Wahl steht noch da, und ein zweiter Klick versucht es erneut.
       Ganze Saetze durch den Katalog, zwei Saetze hintereinander. */
    function fehlerSetzen(paar){ state.fehler = tr(paar[0]) + ". " + tr(paar[1]); }
    var laufZaehler = 0;
    /* true: die Komponente exportiert selbst. false: Bubble-Weg. */
    function exportSelbst(){
      var art = state.type, cfg = EXPORTE[art], k = kern();
      if (!cfg || !k || (!cfg.neu && BUBBLE_TYP[art])) return false;
      var team = k.getTeam(), zeilen = [], seiten = 0, spalten = null;
      /* neu (Shopping, Ads): was pruefen schon weiss, gilt; fehlt der Export, steht der Satz im
         Dialog statt eines Fehlers. Einen Bubble-Weg gibt es fuer diese Typen nicht. */
      var da = daVon(art), sp = spaltenVon(art);
      /* Alles, was der Lauf braucht, EINMAL beim Start: Filter, Zeitraum und Spaltenwahl. Ein
         setContext oder eine Wahl waehrend des Laufs darf die spaeteren Seiten nicht umstellen. */
      var basis = exportParameter(art, team, 0, cfg.seite);
      var von = isoDate(state.from), bis = isoDate(state.to);
      var aus = state.ohne[cfg.spalten] || {};
      /* Jeder Lauf hat seine Nummer. Abbrechen, Schliessen oder ein neuer Lauf machen die Antworten
         des alten wertlos -- ohne die Nummer haette eine verspaetete Seite des abgebrochenen Laufs
         den neuen weitergefuehrt. */
      var nr = ++laufZaehler;
      state.fehler = ""; state.offen = "";
      state.lauf = { nr: nr, zeilen: 0, gesamt: null, seiten: 0, limit: cfg.seite, kappe: cfg.seite * MAX_SEITEN };
      state.phase = "laeuft";
      closeCalendar();
      renderAll(); fokusFuss();
      function aktiv(){ return state.open && state.phase === "laeuft" && !!state.lauf && state.lauf.nr === nr; }
      function zurueck(){ state.lauf = null; state.phase = "wahl"; renderAll(); fokusFuss(); }
      function scheitern(erg){ if (!aktiv()) return; fehlerSetzen(exportSatz(erg)); zurueck(); }
      function auchBubble(){ if (!aktiv()) return; BUBBLE_TYP[art] = true; state.lauf = null; state.phase = "wahl"; renderAll(); fireExportBubble(); }
      function fehlt(){ if (!aktiv()) return; da.stand = false; zurueck(); daGeaendert(); }
      if (sp && sp.stand === true && sp.spalten){ spalten = sp.spalten; seite(0); return true; }
      k.rpc("export_columns_v1", { p_export: cfg.spalten }, { timeoutMs: 20000 }).then(function(erg){
        if (!aktiv()) return;
        if (da && exportFehlt(erg)) { fehlt(); return; }
        if (!da && ohneRpc(erg)) { auchBubble(); return; }
        var r = spaltenAus(erg);
        if (!r) { scheitern(erg); return; }
        if (sp){ sp.stand = true; sp.spalten = r; }
        spalten = r;
        seite(0);
      }, scheitern);
      function seite(offset){
        if (!aktiv()) return;            /* abgebrochen oder Dialog geschlossen */
        var p = {}; Object.keys(basis).forEach(function(n){ p[n] = basis[n]; });
        p.p_offset = offset;
        k.rpc(cfg.fn, p, { timeoutMs: 120000 }).then(function(erg){
          if (!aktiv()) return;
          if (da && exportFehlt(erg)) { fehlt(); return; }
          if (!da && ohneRpc(erg)) { auchBubble(); return; }
          var d = erg && erg.ok ? erg.daten : null;
          if (!d || !Array.isArray(d.rows)) { scheitern(erg); return; }
          zeilen = zeilen.concat(d.rows);
          seiten++;
          var m = d.meta || {};
          var gesamt = m.total_count == null || m.total_count === "" ? NaN : Number(m.total_count);
          state.lauf.zeilen = zeilen.length; state.lauf.seiten = seiten;
          if (isFinite(gesamt)) state.lauf.gesamt = gesamt;
          if (m.has_more === true && seiten < MAX_SEITEN && d.rows.length){
            renderAll();
            seite(Number(m.offset || offset) + Number(m.limit || cfg.seite));
            return;
          }
          var gewaehlt = spalten.filter(function(c){ return !aus[c.key]; });
          var typName = cfg.datei || (typVon(art) || { label: art }).label;
          var name = "upstreem-" + typName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + von + "-" + bis + ".csv";
          var blob = new Blob([csvBauen(gewaehlt, zeilen)], { type: "text/csv;charset=utf-8" });
          herunterladen(blob, name);
          state.ergebnis = { n: zeilen.length, name: name, blob: blob, groesse: blob.size, gekappt: m.has_more === true };
          state.lauf = null; state.phase = "fertig";
          renderAll(); fokusFuss();
        }, scheitern);
      }
      return true;
    }
    function abbrechen(){
      if (state.phase !== "laeuft") return;
      state.lauf = null; state.phase = "wahl";
      renderAll(); fokusFuss();
    }
    function nochmal(){
      var E = state.ergebnis;
      if (E && E.blob) herunterladen(E.blob, E.name);
    }
    function fireExport(){
      if (state.processing || state.phase !== "wahl") return;   // already sent, ignore a repeat click
      if (gesperrt(state.type) || keineSpalten()) return;
      state.fehler = "";
      if (exportSelbst()) return;
      /* Shopping und Ads gibt es nur in der App: ohne core oder Team kein Bubble-Weg, sondern ein Satz. */
      if (EXPORTE[state.type] && EXPORTE[state.type].neu){ fehlerSetzen(["The export didn't work", "Please try again."]); renderAll(); return; }
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
           sofort ein Satz, und der Dialog bleibt offen (seit Variante D als roter Satz im Dialog). */
        fehlerSetzen(["The export didn't work", "Please try again."]);
        renderAll();
        /* Knapp und ohne Namensliste. Die Meldung selbst bleibt: ein Export, der stumm nichts tut,
           ist der schlimmere Fall. Haeufigste Ursache, gemessen: das Element ist unsichtbar --
           Bubble veroeffentlicht bubble_fn_* nur fuer sichtbare Elemente. In der App (ohneBubble)
           gibt es kein solches Element -- dort sagt es der Satz oben, die Konsole bleibt still. */
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

    /* Ein Druck, der IM Dialog begann und auf dem Schleier endet (Text markieren und darueber
       hinausziehen), schliesst nicht -- dieselbe Regel wie in UC.makeModal. */
    var druckAufSchleier = false;
    overlay.addEventListener("mousedown", function(e){ druckAufSchleier = e.target === overlay; });
    overlay.addEventListener("click", function(e){
      if (state.processing) return;   // locked until window.upstreemExportResolve() is called
      // click on the backdrop (not inside the dialog) closes -- auch waehrend des Laufs (Abbruch)
      if (!elDialog.contains(e.target)){
        if (e.target === overlay && druckAufSchleier) closePopup();
        druckAufSchleier = false;
        return;
      }
      druckAufSchleier = false;
      var t = e.target;
      if (t.closest(".uex-close")){ closePopup(); return; }
      var weg = t.closest("[data-uex-filterweg]");
      if (weg){
        /* Der Filter des Drawers gilt nur fuer diesen Export -- abgewaehlt exportiert der Dialog
           den ganzen Datensatz. Der Chip ist danach weg, der Fokus geht auf "Export ...". */
        var feld = weg.getAttribute("data-uex-filterweg");
        if (feld === "url" || feld === "domain" || feld === "promptId" || feld === "brandId") state[feld] = "";
        if (feld === "promptId" || feld === "brandId") state.filterLabel = "";
        renderAll(); fokusFuss(); return;
      }
      var kopf = t.closest("[data-uex-zeile]");
      if (kopf){
        var z = kopf.getAttribute("data-uex-zeile");
        state.offen = state.offen === z ? "" : z;
        if (state.offen !== "zeit") closeCalendar();
        if (z === "spalten") spaltenHolen(state.type);
        renderAll(); return;
      }
      var typeBtn = t.closest("[data-type]");
      if (typeBtn){ typSetzen(typeBtn.getAttribute("data-type")); state.fehler = ""; pruefen(); spaltenHolen(state.type); persist(); renderAll(); return; }
      var presetBtn = t.closest("[data-preset]");
      if (presetBtn){ state.fehler = ""; applyPreset(presetBtn.getAttribute("data-preset")); return; }
      /* Nur Tastatur kommt hier an (die Maus trifft den unsichtbaren Ausloeser darueber). Der Klick
         des Ausloesers stoppt seine eigene Ausbreitung; dieser hier wird gestoppt, damit der
         Aussen-Klick-Waechter der Dropdowns das eben geoeffnete Feld nicht gleich wieder schliesst. */
      if (t.closest(".uex-custom-btn")){ e.stopPropagation(); kalenderOeffnen(); return; }
      var sp = t.closest("[data-spalte]");
      if (sp){
        var cfg = EXPORTE[state.type];
        if (!cfg) return;
        var aus = state.ohne[cfg.spalten] || (state.ohne[cfg.spalten] = {});
        var key = sp.getAttribute("data-spalte");
        if (aus[key]) delete aus[key]; else aus[key] = true;
        persist(); renderAll(); return;
      }
      if (t.closest("[data-uex-alle]")){
        var c2 = EXPORTE[state.type];
        if (c2) delete state.ohne[c2.spalten];
        persist(); renderAll();
        fokus(q('.uex-zeile[data-zeile="spalten"] [data-spalte]'));
        return;
      }
      if (t.closest(".uex-zweit")){ if (state.phase === "laeuft") abbrechen(); else if (state.phase === "fertig") nochmal(); return; }
      if (t.closest(".uex-submit")){ if (state.phase === "fertig") closePopup(); else fireExport(); return; }
    });

    /* Tastatur im Dialog: Pfeile in einer Radiogruppe (Data, Date range) wandern und waehlen --
       ausser auf "Custom range", das erst Enter oeffnet; Tab bleibt im Fenster (aria-modal
       verspricht das, dieselbe Falle wie im Tarif-Fenster in core). */
    overlay.addEventListener("keydown", function(e){
      if (!state.open) return;
      if (e.key === "Tab"){
        var f = [].filter.call(elDialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
          function(x){ return !x.disabled && x.tabIndex >= 0 && x.getClientRects().length > 0 && !x.closest("[hidden]") && !x.closest(".uex-cal-slot"); });
        if (!f.length) return;
        var erst = f[0], letzt = f[f.length - 1], akt = document.activeElement;
        if (e.shiftKey && (akt === erst || !elDialog.contains(akt))){ e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && (akt === letzt || !elDialog.contains(akt))){ e.preventDefault(); erst.focus(); }
        return;
      }
      var r = e.target && e.target.closest ? e.target.closest('[role="radio"]') : null;
      var grp = r && r.closest('[role="radiogroup"]');
      if (!grp) return;
      var schritt = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : ((e.key === "ArrowUp" || e.key === "ArrowLeft") ? -1 : 0);
      if (!schritt) return;
      e.preventDefault();
      var alle = [].filter.call(grp.querySelectorAll('[role="radio"]'), function(x){ return !x.classList.contains("is-aus"); });
      var i = alle.indexOf(r);
      var ziel = alle[(i + schritt + alle.length) % alle.length];
      if (!ziel) return;
      fokus(ziel);
      if (!ziel.classList.contains("uex-custom-btn")) ziel.click();
      fokus(ziel);
    });

    document.addEventListener("keydown", function(e){
      if (e.key === "Escape" && state.open && !state.processing){
        // let the calendar close its own panel first if that's what's open
        /* .udr-menu, nicht .udr-panel -- den Selektor gibt es nicht, die Pruefung lief also
           immer ins Leere und Escape schloss den Dialog samt offenem Kalender. */
        var calPanel = document.querySelector(".udr-menu.is-shown, .udr-wrap.is-open");
        if (calPanel) return;
        /* Auch waehrend des Laufs: Schliessen bricht ab (der Satz unter dem Balken sagt es). */
        closePopup();
      }
    /* EINFANGPHASE (16.10. gemessen): core schliesst offene Dropdowns mit einem eigenen keydown am
       Dokument, der VOR diesem lief -- hier war das Kalenderfeld dann schon zu, und dasselbe Escape
       schloss den ganzen Dialog. In der Einfangphase sieht diese Pruefung das Feld noch offen. */
    }, true);

    /* Eine Antwort von pruefen/spaltenHolen (oder ein fehlender Export beim Klick) zeichnet den
       offenen Dialog neu -- auch wenn ein anderer Controller gefragt hat. */
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

    /* Der Kalender wird gleich angelegt (siehe kalenderAnlegen); ein Fehler dabei kostet nur den
       Custom-Bereich, den Dialog nie. */
    try { kalenderAnlegen(); } catch(e){}
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
        /* Waehrend ein Export laeuft oder fertig dasteht, bleibt der Dialog bei seinem Datensatz --
           ein neuer Kontext gilt fuer das naechste Oeffnen. */
        if (state.open && state.phase !== "wahl") return true;
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
        /* filter_label (16.10., Variante D): der lesbare Name zu prompt_id bzw. brand_id fuer den
           Chip im Kopf ("filtered to VW"). Ohne ihn steht dort "This brand" / "This prompt". */
        state.filterLabel = opts.filter_label != null ? String(opts.filter_label) : "";
        /* SHOPPING UND ADS (16.10.): params je Typ der Gruppe (die Filter der Seite in den Namen der
           Liste), filter_aktiv je Typ (ob der Kopf den Chip "Page filters" zeigt) und der Zeitraum
           der Seite als Vorgabe. Bei jedem Aufruf neu gesetzt, auch auf leer, und beim Schliessen
           geleert (closePopup) -- ein Kontext gilt fuer DIESEN Export. */
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
