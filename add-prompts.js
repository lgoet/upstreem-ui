/* upstreem add-prompts.js — the "Add prompts" modal (prefix `uap`).
   Load core.js first.

   Unlike every other component in this repo this one has NO visible element of its own. It exposes
   window.openAddPrompts() and builds its modal into <body> the first time that is called. The
   reason is that the trigger already exists in two places — the Add button in the prompts page
   header and "Add New Prompt" in Quick Actions — and neither of them wants to own a second HTML
   element just to host a dialog. A caller that cannot reach this file still works: the page header
   falls back to the event it fired before.

   ── The two ways in ─────────────────────────────────────────────────────────────
   MANUAL   one field, Enter commits the line and clears the field. Shift+Enter puts a line break
            INSIDE the prompt. Pasting multi-line text commits one prompt per line, which is what
            Linear and Notion do and what people try first when they already have a list somewhere.
   CSV      file picker or drop, parsed here in the browser. Both ways feed the SAME staged list,
            so everything below the switcher — editing a row, removing it, market, topics — works
            identically no matter where the rows came from.

   Nothing is sent until the footer button is pressed, and then it is ONE event carrying the whole
   batch. That follows prompt-research's acceptAllSuggestedPrompts: one workflow run rather than
   one per prompt.

   ── Why the CSV work is done here and not in Bubble ─────────────────────────────
   Reading a file needs no server: FileReader gives us the bytes, TextDecoder turns them into text,
   a Blob plus a self-clicking <a download> hands the template back. Doing it in the browser also
   means the user sees a bad row BEFORE anything is created, instead of after a workflow already
   ran. The four things that actually break real spreadsheets are handled explicitly — see the CSV
   section below; each one of them is a silent data-corruption bug if it is skipped. */
(function () {
  /* ---- boot stubs (STYLEGUIDE §25) --------------------------------------------------------
     Bubble fires workflows before this file finishes loading. openAddPrompts in particular is
     wired to a button the user can hit during the first second of a page's life.

     VOR der UC-Pruefung, und das ist der Punkt. Frueher stand dieser Block DAHINTER: war core.js
     noch nicht da, kehrte die Datei vorher zurueck und legte gar keine Stubs an -- obwohl der
     Kommentar darueber genau diesen Fall beschreibt. Gemeldet als
     "setUpstreemDefaultMarket is not defined" beim Seitenaufbau. Die Stubs brauchen UC nicht,
     sie merken einen Aufruf nur vor. */
  var API_NAMES = ["openAddPrompts", "closeAddPrompts", "resetAddPrompts", "setAddPromptsTheme",
                   "setUpstreemDefaultMarket"];
  var Q = (window.__uapBootQueue = window.__uapBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  /* Und weiter versuchen, statt aufzugeben. Bubble haengt die Skripte per jQuery .html() ein,
     was die Reihenfolge nicht garantiert -- diese Datei kann vor core.js laufen. Ein einmaliger
     Fehlschlag hiess bisher: Komponente tot bis zum Neuladen. Gleiche Bauart wie in
     date-range.js und den anderen 26 Dateien dieser Familie. */
  function uapBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uapBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uapStart();
  }

  function uapStart(){
  var UC = window.UpstreemCore;

  /* tr und nicht t: t ist in dieser Datei mehrfach eine lokale Textvariable (r.text), ein
     zweites t waere ein Fehler, der erst zur Laufzeit auffaellt. */
  var esc = UC.esc, toNum = UC.toNum, tr = UC.t || function (s) { return s; };
  /* One batch is capped. 100 is not a technical limit -- it is the point past which a single
     Bubble workflow run stops being a sensible unit of work, and a 10.000-row import would sit
     there building a payload nobody wants to debug. Nothing about the cap is shown until it is
     actually reached; a counter that says "0 / 100" on an empty dialog is noise. */
  var MAX_PROMPTS = 100;

  var ICON = {
    /* All Feather, taken from the set. */
    x:       '<svg viewBox="0 0 24 24"><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"/></svg>',
    plus:    '<svg viewBox="0 0 24 24"><path d="M11.9922 4.00012V20.0001M19.9922 12.0001H3.99222"/></svg>',
    edit:    '<svg viewBox="0 0 24 24"><path d="M7.99219 16L8.71615 13.1041C8.89023 12.4078 9.25026 11.772 9.75776 11.2644L16.4171 4.60509L17.4071 3.6151C18.2272 2.79497 19.557 2.79497 20.3771 3.6151C21.1972 4.43524 21.1972 5.76493 20.3771 6.58507L19.3871 7.57506L12.7277 14.2344C12.2202 14.7419 11.5843 15.102 10.888 15.276L7.99219 16Z"/><path d="M18.9921 13.5C18.9921 16.7875 18.9921 18.4312 18.0842 19.5376C17.918 19.7401 17.7322 19.9258 17.5297 20.092C16.4234 21 14.7796 21 11.4921 21H10.9922C7.22095 21 5.33535 21 4.16378 19.8284C2.99222 18.6569 2.99219 16.7712 2.99219 13V12.5C2.99219 9.21252 2.99219 7.56879 3.90013 6.46244C4.06636 6.2599 4.25208 6.07417 4.45463 5.90794C5.56098 5 7.20471 5 10.4922 5"/></svg>',
    upload:  '<svg viewBox="0 0 24 24"><path d="M2.99994 17C2.99994 17.93 2.99994 18.395 3.10216 18.7765C3.37956 19.8117 4.18821 20.6204 5.22348 20.8978C5.60498 21 6.06997 21 6.99994 21L16.9999 21C17.9299 21 18.3949 21 18.7764 20.8978C19.8117 20.6204 20.6203 19.8117 20.8977 18.7765C20.9999 18.395 20.9999 17.93 20.9999 17"/><path d="M16.5 7.49993C16.5 7.49993 13.1858 2.99997 12 2.99996C10.8141 2.99995 7.50002 7.49996 7.50002 7.49996M12 3.99996V16"/></svg>',
    download:'<svg viewBox="0 0 24 24"><path d="M16.9504 12.1817C17.1981 12.814 16.5076 13.5726 15.1267 15.0899C13.6702 16.6902 12.9201 17.4904 12 17.5C11.0799 17.4904 10.3298 16.6902 8.87331 15.0899C7.49239 13.5726 6.80193 12.814 7.04964 12.1817C7.05868 12.1586 7.06851 12.1359 7.0791 12.1135C7.34928 11.542 8.24477 11.5029 10 11.5002V4.99998C10 4.53501 10 4.30253 10.0511 4.11179C10.1898 3.59414 10.5941 3.1898 11.1118 3.05111C11.3025 3 11.535 3 12 3C12.4649 3 12.6974 3 12.8882 3.05111C13.4058 3.1898 13.8102 3.59414 13.9489 4.11179C14 4.30253 14 4.53501 14 4.99998V11.5002C15.7552 11.5029 16.6507 11.542 16.9209 12.1135C16.9315 12.1359 16.9413 12.1586 16.9504 12.1817Z"/><path d="M5.00006 21H19.0001"/></svg>',
    pin:     '<svg viewBox="0 0 24 24"><path d="M7 9.00183C4.82497 9.01495 3.64706 9.11944 2.87868 9.95185C2 10.9038 2 12.4358 2 15.4999C2 18.5641 2 20.0961 2.87868 21.048C3.75736 21.9999 5.17157 21.9999 8 21.9999H16C18.8284 21.9999 20.2426 21.9999 21.1213 21.048C22 20.0961 22 18.5641 22 15.4999C22 12.4358 22 10.9038 21.1213 9.95185C20.3529 9.11944 19.175 9.01495 17 9.00183"/><path d="M6 12L10.5 14.625M18 19L13.8 16.55M13.8 16.55L18 13.75M13.8 16.55L10.5 14.625M10.5 14.625L6 17.6"/><path d="M12 7C13.3807 7 14.5 5.88071 14.5 4.5C14.5 3.11929 13.3807 2 12 2C10.6193 2 9.5 3.11929 9.5 4.5C9.5 5.88071 10.6193 7 12 7ZM12 7V11"/></svg>',
    /* Lucide "tags", nicht "tag": der Bereich meint die MENGE der Themen, und zwei
       Anhaenger sagen das. Derselbe Wechsel wie im Prompts-Seitenkopf und in core. */
    tag:     '<svg viewBox="0 0 24 24"><path d="M16.9017 6.12874C18 7.25748 18 9.07416 18 12.7075V14.2925C18 17.9258 18 19.7425 16.9017 20.8713C15.8033 22 14.0355 22 10.5 22C6.96447 22 5.1967 22 4.09835 20.8713C3 19.7425 3 17.9258 3 14.2925V12.7075C3 9.07416 3 7.25748 4.09835 6.12874C5.1967 5 6.96447 5 10.5 5C14.0355 5 15.8033 5 16.9017 6.12874Z"/><path d="M7.5 5.5V10.3693C7.5 11.3046 7.5 11.7722 7.78982 11.9396C8.35105 12.2638 9.4038 11.1823 9.90375 10.8567C10.1937 10.6678 10.3387 10.5734 10.5 10.5734C10.6613 10.5734 10.8063 10.6678 11.0962 10.8567C11.5962 11.1823 12.6489 12.2638 13.2102 11.9396C13.5 11.7722 13.5 11.3046 13.5 10.3693V5.5"/><path d="M9 2H11C15.714 2 18.0711 2 19.5355 3.46447C21 4.92893 21 7.28595 21 12V18"/></svg>',
    search:  '<svg viewBox="0 0 24 24"><path d="M17 17L21 21"/><path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"/></svg>',
    alert:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16V12"/><path d="M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z"/></svg>',
    file:    '<svg viewBox="0 0 24 24"><path d="M8 18H16"/><path d="M8 14H16"/><path d="M8 10H10"/><path d="M13 2.5V3C13 5.82843 13 7.24264 13.8787 8.12132C14.7574 9 16.1716 9 19 9H19.5M20 10.6569V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V9.45584C4 6.21082 4 4.58831 4.88607 3.48933C5.06508 3.26731 5.26731 3.06508 5.48933 2.88607C6.58831 2 8.21082 2 11.4558 2C12.1614 2 12.5141 2 12.8372 2.11401C12.9044 2.13772 12.9702 2.165 13.0345 2.19575C13.3436 2.34355 13.593 2.593 14.0919 3.09188L18.8284 7.82843C19.4065 8.40649 19.6955 8.69552 19.8478 9.06306C20 9.4306 20 9.83935 20 10.6569Z"/></svg>',
    chev:    '<svg viewBox="0 0 24 24"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg>',
    /* Feather x at its own stroke weight, the clear glyph the other three pickers use. */
    xThin:   '<svg viewBox="0 0 24 24"><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"/></svg>',
    corner:  '<svg viewBox="0 0 24 24"><path d="M11 6H15.5C17.9853 6 20 8.01472 20 10.5C20 12.9853 17.9853 15 15.5 15H4"/><path d="M6.99998 12C6.99998 12 4.00001 14.2095 4 15C3.99999 15.7906 7 18 7 18"/></svg>'
  };

  /* =============================================================================================
     CSV

     Four things break real spreadsheets, and every one of them corrupts data silently rather than
     failing loudly. They are handled here, in this order, because each depends on the one before.

     1 ENCODING. Excel on Windows still writes Windows-1252 by default, not UTF-8. Decoded as UTF-8
       those bytes come out as U+FFFD, so "für Handwerker" turns into rubbish and the prompt is
       created anyway. We decode as UTF-8 first, look for the replacement character, and only then
       fall back to windows-1252 — that order matters, because a real UTF-8 file decoded as 1252
       produces Ã¤-style mojibake WITHOUT any replacement character to detect it by.
     2 BOM. A UTF-8 byte order mark sits in front of the first header cell and turns "prompt_text"
       into "﻿prompt_text", which then matches no column name.
     3 DELIMITER. A German Excel writes semicolons. A template downloaded with commas, opened and
       saved once, comes back semicolon-separated. Guessing from the header row costs four lines
       and removes the whole class of "my import put everything in one column".
     4 QUOTING. A prompt like: Wer bietet "KI-Schulungen" an, und wo?  is a single quoted field
       with a doubled "" inside and a comma in the middle. split(delim) tears it in half. The
       parser below walks character by character; there is no shortcut that stays correct.
     ============================================================================================= */

  function decodeCsvBytes(buf) {
    var bytes = new Uint8Array(buf);
    var text;
    if (window.TextDecoder) {
      text = new TextDecoder("utf-8").decode(bytes);
      /* U+FFFD means those bytes were not valid UTF-8 -- almost always a Windows Excel export. */
      if (text.indexOf("�") >= 0) {
        try { text = new TextDecoder("windows-1252").decode(bytes); } catch (e) {}
      }
    } else {
      text = String.fromCharCode.apply(null, bytes);
    }
    return text.replace(/^﻿/, "");
  }

  function detectDelim(firstLine) {
    var best = ",", bestN = 0;
    [";", ",", "\t", "|"].forEach(function (d) {
      var n = firstLine.split(d).length - 1;
      if (n > bestN) { bestN = n; best = d; }
    });
    return best;
  }

  /* Returns an array of rows, each an array of cell strings. Handles quoted fields with embedded
     delimiters, embedded newlines and doubled quotes, plus CRLF/LF/CR line endings. */
  function parseCsv(text, delim) {
    var rows = [], row = [], cell = "", i = 0, n = text.length, inQ = false;
    function endCell() { row.push(cell); cell = ""; }
    function endRow() { endCell(); rows.push(row); row = []; }
    while (i < n) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { cell += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        cell += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === delim) { endCell(); i++; continue; }
      if (c === "\r") { if (text.charAt(i + 1) === "\n") i++; endRow(); i++; continue; }
      if (c === "\n") { endRow(); i++; continue; }
      cell += c; i++;
    }
    if (cell !== "" || row.length) endRow();
    return rows;
  }

  /* A cell is quoted only when it has to be. Excel and Sheets both accept that. */
  function csvCell(v, delim) {
    var s = String(v == null ? "" : v);
    if (s.indexOf('"') >= 0 || s.indexOf(delim) >= 0 || /[\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /* Semicolon plus a UTF-8 BOM, deliberately. This template's job is to survive being opened in
     Excel, edited and saved -- and a German Excel both expects and writes semicolons. Handing out
     a comma file means the very first double-click drops every value into column A. The BOM is
     what makes Excel read the file as UTF-8 instead of the system code page, i.e. it is what keeps
     the umlauts. Our own importer detects the delimiter anyway, so a comma file still imports. */
  var TEMPLATE_DELIM = ";";
  function templateCsv() {
    var d = TEMPLATE_DELIM;
    /* Placeholders, not example prompts. A template full of plausible German prompts gets filled
       in AROUND the examples and they end up imported as real rows. */
    var lines = [
      ["prompt_text", "market"],
      ["prompt text 1", "de"],
      ["prompt text 2", ""],
      ["prompt text 3", ""]
    ];
    return "﻿" + lines.map(function (r) {
      return r.map(function (c) { return csvCell(c, d); }).join(d);
    }).join("\r\n") + "\r\n";
  }

  function downloadCsv(filename, content) {
    var blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    a.style.position = "fixed"; a.style.left = "-9999px";
    document.body.appendChild(a);
    a.click();
    /* Revoking immediately cancels the download in Safari; one tick is enough everywhere. */
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, 0);
  }

  /* Column names are matched loosely: header casing, spaces and underscores vary between whoever
     exported the file. Anything we do not recognise is ignored rather than rejected. */
  function normHeader(h) {
    return String(h == null ? "" : h).trim().toLowerCase().replace(/[\s_-]+/g, "");
  }
  var TEXT_KEYS   = ["prompttext", "prompt", "text", "query", "frage"];
  var MARKET_KEYS = ["market", "markt", "country", "land", "alpha2", "countrycode"];

  function rowsFromCsv(text) {
    var firstLine = text.split(/\r\n|\r|\n/)[0] || "";
    var grid = parseCsv(text, detectDelim(firstLine)).filter(function (r) {
      return r.some(function (c) { return String(c).trim() !== ""; });
    });
    if (!grid.length) return { rows: [], skipped: 0, note: "That file has no rows." };

    var head = grid[0].map(normHeader);
    var iText = -1, iMarket = -1, k;
    for (k = 0; k < head.length; k++) {
      if (iText < 0 && TEXT_KEYS.indexOf(head[k]) >= 0) iText = k;
      if (iMarket < 0 && MARKET_KEYS.indexOf(head[k]) >= 0) iMarket = k;
    }
    var body, note = "";
    if (iText < 0) {
      /* No recognisable header: treat the whole file as headerless, first column is the prompt.
         Refusing outright would be worse -- a one-column list of prompts is exactly what someone
         pastes out of a spreadsheet, and it needs no header to be unambiguous. */
      iText = 0; iMarket = grid[0].length > 1 ? 1 : -1;
      body = grid;
      note = "No header row recognised, first column read as the prompt.";
    } else {
      body = grid.slice(1);
    }

    var out = [], skipped = 0;
    body.forEach(function (r) {
      var t = String(r[iText] == null ? "" : r[iText]).trim();
      if (!t) { skipped++; return; }
      var m = iMarket >= 0 ? String(r[iMarket] == null ? "" : r[iMarket]).trim() : "";
      out.push({ text: t, market: normMarket(m) });
    });
    return { rows: out, skipped: skipped, note: note };
  }

  /* alpha2 is the identity everywhere else in the app, so that is what a cell has to become. A
     full country name is accepted too and looked up against the market store -- somebody WILL
     type "Germany" into that column, and silently importing it as a market called "Germany" that
     matches nothing is the kind of failure that only shows up weeks later. */
  function normMarket(v) {
    var s = String(v == null ? "" : v).trim();
    if (!s) return "";
    if (/^[A-Za-z]{2}$/.test(s)) return s.toLowerCase();
    var list = UC.getMarkets ? UC.getMarkets() : [];
    var lower = s.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (String(m.name || "").toLowerCase() === lower) return String(m.alpha2 || "").toLowerCase();
      if (String(m.alpha3 || "").toLowerCase() === lower) return String(m.alpha2 || "").toLowerCase();
    }
    return "";      // unknown -- the row still imports, just without a market
  }

  /* =============================================================================================
     The modal. One instance for the whole page, built on first open and then reused: rebuilding it
     per open would drop the market and topic subscriptions every time.
     ============================================================================================= */

  var M = null;                 // the built DOM, or null before the first open
  var fire = null;              // UC.makeFire bound to the modal root, built with it
  var isOpen = false;           // the ONE source of truth for "is the dialog up"

  /* The shell is core's .up-topicmodal-backdrop, not a local copy of it and not a top-layer
     popover. Both of those were mine and both were wrong.

     The local copy re-derived positioning and stacking that core had already solved, and got them
     wrong. The popover fixed the stacking by leaving the document's stacking order entirely --
     which puts the dialog above EVERYTHING, including the host's own drawers, so it read as
     floating too far in front. core's modal sits at z-index 100000, inside the document, exactly
     where this app expects a modal to sit; it has been correct in this product for months.

     So this file contributes layout INSIDE the card and nothing about where the card is. */
  function showShell() {
    M.back.classList.add("is-shown");
    /* Der Sprachlauf ueberspringt unsichtbare Aeste. Dieses Fenster haengt beim Seitenstart
       schon im Dokument und geht nur ueber eine Klasse auf -- es haengt also nichts ein, der
       Beobachter feuert nie, und die Platzhalter blieben englisch (19.09. gemeldet). Eine
       Aufgabe spaeter, damit die Klasse sicher steht. */
    setTimeout(function(){
      var k = window.UpstreemCore;
      try { if (k && k.spracheLauf) k.spracheLauf(M.back); } catch(e){}
    }, 0);
  }
  function hideShell() { M.back.classList.remove("is-shown"); }
  var S = {
    tab: "manual",              // "manual" | "csv"
    rows: [],                   // [{ id, text, market }]
    tags: {},                   // batch topics, id -> true
    market: "",                 // batch market (alpha2), applied to rows without one
    csvNote: "", csvSkipped: 0, csvName: "", capNote: "",
    editing: null,              // row id being edited inline
    pick: null,                 // null | "market" | "tags"
    pickQuery: "",
    saving: false,
    opener: null                // element to restore focus to on close
  };
  var seq = 0;
  /* Set once per page load from Bubble. Lives on window so a second copy of this file (two
     data-cdn-pin values on one page) sees the same value. */
  var DEFAULT_MARKET = (window.__uapDefaultMarket || "");

  function marketName(a2) {
    if (!a2) return "";
    var list = UC.getMarkets ? UC.getMarkets() : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].alpha2 || "").toLowerCase() === a2) return String(list[i].name || a2.toUpperCase());
    }
    return a2.toUpperCase();
  }
  function flagUrl(a2) {
    if (!a2) return "";
    var list = UC.getMarkets ? UC.getMarkets() : [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].alpha2 || "").toLowerCase() === a2 && list[i].flag_url) return String(list[i].flag_url);
    }
    return "https://flagcdn.com/" + a2 + ".svg";
  }
  function topicById(id) {
    var list = UC.getTopics ? UC.getTopics() : [];
    for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i];
    return null;
  }
  /* Schreibt das aktuelle Theme auf einen Knoten. Der Dialog haengt im <body>, ausserhalb jeder
     Komponentenwurzel; core's Theme-Beobachter faende ihn zwar, aber erst NACH dem Einhaengen --
     und bis dahin greift die Light-Palette. Im Dark Mode war das ein sehr heller Feldrahmen auf
     dunklem Grund, sichtbar bis der Beobachter nachzog. */
  function applyThemeOn(el) {
    if (!el) return;
    var dark = UC.getUpstreemTheme ? UC.getUpstreemTheme() === "dark" : false;
    if (dark) el.setAttribute("data-theme", "dark");
    else el.removeAttribute("data-theme");
  }
  function applyTheme() { if (M) applyThemeOn(M.back); }

  function topicHex(t) {
    var dark = UC.getUpstreemTheme ? UC.getUpstreemTheme() === "dark" : false;
    return (dark ? t.hex_dark : t.hex_light) || t.hex_light || t.hex_dark || "#808080";
  }
  function selectedTagIds() {
    return Object.keys(S.tags).filter(function (k) { return S.tags[k]; });
  }

  /* Returns how many were turned away by the cap, so the caller can say so once instead of the
     component announcing a limit nobody has hit yet. */
  /* Same prompt twice in one batch is always a mistake, never an intent -- and it is the single
     most common thing a spreadsheet contains. Compared on the trimmed, case-folded text, which is
     what "the same prompt" means to a person; whitespace and capitalisation are not a difference
     worth creating a second row for. */
  function normKey(t) { return String(t == null ? "" : t).trim().toLowerCase().replace(/\s+/g, " "); }

  function addRows(list) {
    var dropped = 0, dupes = 0, seen = {};
    S.rows.forEach(function (r) { seen[normKey(r.text)] = 1; });
    list.forEach(function (r) {
      var t = String(r.text == null ? "" : r.text).trim();
      if (!t) return;
      var k = normKey(t);
      if (seen[k]) { dupes++; return; }
      if (S.rows.length >= MAX_PROMPTS) { dropped++; return; }
      seen[k] = 1;
      S.rows.push({ id: "r" + (++seq), text: t, market: r.market || "" });
    });
    var notes = [];
    /* Muster statt Stuecke: "3" + " duplicates skipped" laesst sich nicht uebersetzen, der Satz
       als Ganzes schon -- und nur so steht das Verb im Deutschen richtig. */
    if (dupes)   notes.push(dupes === 1 ? tr("1 duplicate skipped")
                                        : tr("{n} duplicates skipped").replace("{n}", dupes));
    if (dropped) notes.push((dropped === 1 ? tr("1 more row left out")
                                           : tr("{n} more rows left out").replace("{n}", dropped)) +
                            " — " + tr("{n} prompts per batch").replace("{n}", MAX_PROMPTS));
    S.capNote = notes.join(" · ");
    return dropped + dupes;
  }

  /* ---------------- markup ---------------- */

  /* One picker: trigger plus menu, built exactly like markets-filter's. Both chevron glyphs live
     in the DOM and CSS swaps them on hover — rendering the X through JS would need listeners on a
     node that gets rebuilt on every selection change, and the two would drift apart. */
  function pickerHtml(kind, icon, label, tip) {
    return '<div class="uap-pickwrap" data-pick="' + kind + '">' +
             '<button type="button" class="uap-trigger" data-act="pick-' + kind + '"' +
               ' aria-haspopup="listbox" aria-expanded="false" data-tip="' + esc(tip) + '">' +
               '<span class="uap-trigger-ic">' + icon + '</span>' +
               '<span class="uap-label">' + esc(label) + '</span>' +
               '<span class="uap-chev">' +
                 '<span class="uap-chev-down">' + ICON.chev + '</span>' +
                 '<span class="uap-chev-x" role="button" tabindex="-1" aria-label="Clear">' + ICON.xThin + '</span>' +
               '</span>' +
             '</button>' +
             '<div class="uap-menu" role="dialog">' +
               '<div class="uap-search-row">' +
                 '<span class="up-ddsearch uap-search">' +
                   '<input class="up-ddsearch-in uap-search-in" type="text"' +
                     ' placeholder="Search ' + (kind === "market" ? "markets" : "topics") + '"' +
                     ' aria-label="Search ' + (kind === "market" ? "markets" : "topics") + '">' +
                   '<span class="up-ddsearch-ic">' + ICON.search + '</span>' +
                   /* BOTH glyphs, always in the DOM. core swaps them through .has-text on the
                      wrapper: .up-ddsearch.has-text hides the magnifier and shows this button.
                      Shipping only the magnifier is why the field had no way to be cleared. */
                   '<button class="up-ddsearch-x uap-search-x" type="button" aria-label="Clear search">' +
                     ICON.x + '</button>' +
                 '</span>' +
               '</div>' +
               '<div class="uap-list-opts" role="listbox"></div>' +
             '</div>' +
           '</div>';
  }

  function rowHtml(r) {
    var mk = r.market || S.market;
    var chip = mk
      ? '<span class="uap-rowmarket" title="' + esc(marketName(mk)) + '">' +
          '<img class="uap-flag" src="' + esc(flagUrl(mk)) + '" alt="">' +
          '<span class="uap-rowmarket-code">' + esc(mk.toUpperCase()) + '</span>' +
        '</span>'
      : "";
    if (S.editing === r.id) {
      return '<li class="uap-row is-editing" data-id="' + esc(r.id) + '">' +
               '<textarea class="uap-rowedit" rows="1">' + esc(r.text) + '</textarea>' +
             '</li>';
    }
    return '<li class="uap-row" data-id="' + esc(r.id) + '">' +
             '<span class="uap-rowtext">' + esc(r.text) + '</span>' +
             chip +
             '<button type="button" class="uap-rowbtn" data-act="edit" data-tip="Edit">' + ICON.edit + '</button>' +
             '<button type="button" class="uap-rowbtn" data-act="del" data-tip="Remove">' + ICON.x + '</button>' +
           '</li>';
  }

  /* ---------------- Hoehenanimation des Listenbereichs ----------------
     Der Bereich hat im leeren Zustand keine Hoehe (display:none). Kommt der erste Prompt, waechst
     er von 0 auf seine echte Hoehe; jeder weitere schiebt ihn um eine Zeile weiter, bis .uap-list
     an ihren max-height-Deckel stoesst und stattdessen scrollt -- ab da ist die gemessene
     Zielhoehe konstant und es bewegt sich nichts mehr.

     Gemessen wird zweimal um den Render herum: vorher der Ist-Wert, nachher der freie Soll-Wert.
     Genau das Muster, das Miras Galerie schon benutzt; ein zweiter Mechanismus fuer dieselbe
     Aufgabe waere die Stelle, an der die beiden Kurven irgendwann auseinanderlaufen.

     Laeuft schon eine Bewegung, ist der Ist-Wert die aktuelle Zwischenhoehe -- schnelles Tippen
     kettet dadurch weich weiter, statt bei jedem Prompt neu anzusetzen. */
  var LIST_MS = 180, LIST_EASE = "cubic-bezier(.4,0,.2,1)";
  var _lwTimer = null;
  function lessMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function lwSettle(wrap) {
    wrap.classList.remove("is-resizing");
    wrap.style.transition = ""; wrap.style.height = "";
    wrap.style.overflow = ""; wrap.style.display = ""; wrap.style.willChange = "";
  }
  function lwAnimate(wrap, h0, h1) {
    /* Haelt die Liste waehrend der Bewegung ungestaucht und ohne eigenen Scrollbalken --
       sonst blitzt er auf, obwohl am Ende nichts zu scrollen ist. Siehe .is-resizing im CSS. */
    wrap.classList.add("is-resizing");
    wrap.style.willChange = "height";
    wrap.style.overflow = "hidden";
    /* Beim Zuklappen muss der Kasten sichtbar bleiben, sonst ist er sofort weg und es gibt
       nichts zu bewegen. Das display kommt am Ende mit lwSettle wieder raus. */
    if (!h1) wrap.style.display = "flex";
    wrap.style.height = h0 + "px";
    /* Erzwungener Reflow, nicht kosmetisch: ohne ihn fasst der Browser Start- und Endwert zu
       einem Style-Recalc zusammen und springt ohne Uebergang auf das Ziel. */
    void wrap.offsetHeight;
    wrap.style.transition = "height " + LIST_MS + "ms " + LIST_EASE;
    wrap.style.height = h1 + "px";
    clearTimeout(_lwTimer);
    _lwTimer = setTimeout(function () { lwSettle(wrap); }, LIST_MS + 40);
  }

  function renderList() {
    var el = M.list, wrap = M.listwrap;
    /* Nur animieren, wenn der Dialog wirklich offen ist -- beim Aufbau waere das Wachsen
       Teil des Erscheinens und saehe aus wie ein Ruckler. */
    var bewegt = !!(isOpen && wrap && !lessMotion());
    var h0 = bewegt ? wrap.getBoundingClientRect().height : 0;

    if (!S.rows.length) {
      el.innerHTML = "";
      M.listwrap.classList.add("is-empty");
    } else {
      M.listwrap.classList.remove("is-empty");
      el.innerHTML = S.rows.map(rowHtml).join("");
    }
    M.count.textContent = S.rows.length
      ? (S.rows.length === 1 ? tr("1 prompt") : tr("{n} prompts").replace("{n}", S.rows.length))
      : tr("No prompts yet");
    M.save.disabled = !S.rows.length || S.saving;
    M.save.textContent = S.rows.length
      ? (S.rows.length === 1 ? tr("Add 1 prompt") : tr("Add {n} prompts").replace("{n}", S.rows.length))
      : tr("Add prompts");
    M.capnote.hidden = !S.capNote;
    if (S.capNote) M.capnote.innerHTML = ICON.alert + '<span>' + esc(S.capNote) + '</span>';

    /* The Enter affordance follows the field, not the list. */
    if (M.enter) M.enter.hidden = !String(M.input.value || "").trim();

    var ed = el.querySelector(".uap-rowedit");
    if (ed) { autosize(ed); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }

    /* Erst jetzt messen: der Inhalt steht, autosize hat die Textarea auf ihre Zeilenzahl
       gebracht. Vorher waere die Zielhoehe die von gestern. */
    if (!bewegt) return;
    clearTimeout(_lwTimer);
    lwSettle(wrap);                                   /* frei messen, ohne Reste der letzten Bewegung */
    var h1 = wrap.getBoundingClientRect().height;
    if (Math.abs(h1 - h0) > 1) lwAnimate(wrap, h0, h1);
  }

  /* The trigger shows what is picked, exactly like the three filter dropdowns: the market's flag
     and name, or the topics as chips. has-sel is what turns the chevron into the clear-X. */
  function renderTriggers() {
    var mk = S.market, trg = M.marketTrigger;
    trg.querySelector(".uap-trigger-ic").innerHTML = mk
      ? '<img class="uap-flag" src="' + esc(flagUrl(mk)) + '" alt="">' : ICON.pin;
    trg.querySelector(".uap-label").textContent = mk ? marketName(mk) : "Market";
    M.marketWrap.classList.toggle("has-sel", !!mk);

    /* Exactly what the topics filter does: at ONE selection the topic's own name wins, because a
       badge showing a 1 says less than the word does; from TWO up the label goes back to "Topics"
       and a filled counter disc carries the number, which keeps the trigger the same width at 2
       and at 12. */
    var ids = selectedTagIds(), tt = M.tagsTrigger, lbl = tt.querySelector(".uap-label");
    var oldBadge = tt.querySelector(".uap-count");
    if (oldBadge) oldBadge.parentNode.removeChild(oldBadge);
    if (ids.length === 1) {
      var t1 = topicById(ids[0]);
      lbl.textContent = t1 ? String(t1.name || "1 Topic") : "1 Topic";
      tt.querySelector(".uap-trigger-ic").innerHTML = t1 && t1.emoji
        ? '<span class="uap-tagemoji">' + esc(t1.emoji) + '</span>'
        : (t1 ? '<span class="uap-tagdot" style="background:' + esc(topicHex(t1)) + '"></span>' : ICON.tag);
    } else {
      lbl.textContent = "Topics";
      tt.querySelector(".uap-trigger-ic").innerHTML = ICON.tag;
      if (ids.length > 1) {
        var b = document.createElement("span");
        b.className = "uap-count";
        b.textContent = String(ids.length);
        tt.insertBefore(b, tt.querySelector(".uap-chev"));
      }
    }
    M.tagsWrap.classList.toggle("has-sel", !!ids.length);
  }

  /* Rows are core's .up-filter-item with core's .up-filter-check -- the same checkbox the topics,
     models and markets dropdowns use, in both themes. Drawing an own one was the first version's
     mistake: it looked close in light mode and wrong in dark, because core flips the tick colour. */
  function optsHtml(kind) {
    var q = S.pickQuery.toLowerCase();
    if (kind === "market") {
      var list = (UC.getMarkets ? UC.getMarkets() : []).filter(function (m) {
        return !q || String(m.name || "").toLowerCase().indexOf(q) >= 0 ||
                     String(m.alpha2 || "").toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return '<div class="uap-noopt">No markets found</div>';
      return list.map(function (m) {
        var a2 = String(m.alpha2 || "").toLowerCase(), on = a2 === S.market;
        return '<div class="up-filter-item uap-opt' + (on ? " is-checked" : "") +
               '" role="option" tabindex="0" aria-selected="' + (on ? "true" : "false") +
               '" data-val="' + esc(a2) + '">' +
                 '<span class="up-filter-check">' + UC.CHECK_SVG + '</span>' +
                 '<span class="uap-opt-main">' +
                   '<img class="uap-flag uap-opt-flag" src="' + esc(flagUrl(a2)) + '" alt="">' +
                   '<span class="uap-opt-name">' + esc(m.name || a2.toUpperCase()) + '</span>' +
                 '</span>' +
                 '<span class="uap-opt-count">' + toNum(m.prompt_count) + '</span>' +
               '</div>';
      }).join("");
    }
    var tl = (UC.getTopics ? UC.getTopics() : []).filter(function (t) {
      if (t.is_active === false) return false;
      return !q || String(t.name || "").toLowerCase().indexOf(q) >= 0;
    });
    if (!tl.length) return '<div class="uap-noopt">No topics found</div>';
    return tl.map(function (t) {
      var on = !!S.tags[t.id];
      var mark = t.emoji ? '<span class="uap-tagemoji">' + esc(t.emoji) + '</span>'
                         : '<span class="uap-tagdot" style="background:' + esc(topicHex(t)) + '"></span>';
      return '<div class="up-filter-item uap-opt' + (on ? " is-checked" : "") +
             '" role="option" tabindex="0" aria-selected="' + (on ? "true" : "false") +
             '" data-val="' + esc(t.id) + '">' +
               '<span class="up-filter-check">' + UC.CHECK_SVG + '</span>' +
               '<span class="uap-opt-main">' + mark +
                 '<span class="uap-opt-name">' + esc(t.name || "") + '</span>' +
               '</span>' +
             '</div>';
    }).join("");
  }

  function renderMenus() {
    ["market", "tags"].forEach(function (k) {
      var wrap = k === "market" ? M.marketWrap : M.tagsWrap;
      var open = S.pick === k;
      wrap.classList.toggle("is-open", open);
      wrap.querySelector(".uap-trigger").setAttribute("aria-expanded", open ? "true" : "false");
      wrap.querySelector(".uap-menu").classList.toggle("is-shown", open);
      if (open) wrap.querySelector(".uap-list-opts").innerHTML = optsHtml(k);
    });
    if (S.pick) {
      var owner = S.pick === "market" ? M.marketWrap : M.tagsWrap;
      var inp = owner.querySelector(".uap-search-in");
      if (inp && inp.value !== S.pickQuery) inp.value = S.pickQuery;
      /* The wrapper class is state, not a side effect of typing: a menu that reopens with a query
         still in it must show the X, and one that was cleared must show the magnifier again. */
      var wrap = owner.querySelector(".up-ddsearch");
      if (wrap) wrap.classList.toggle("has-text", !!S.pickQuery.length);
      if (inp) inp.focus();
    }
  }

  function renderCsvNote() {
    if (!S.csvNote && !S.csvSkipped && !S.csvName) { M.csvnote.hidden = true; return; }
    M.csvnote.hidden = false;
    var bits = [];
    if (S.csvName) bits.push(esc(S.csvName));
    if (S.csvSkipped) bits.push(S.csvSkipped === 1 ? tr("1 row skipped")
                                                    : tr("{n} rows skipped").replace("{n}", S.csvSkipped));
    if (S.csvNote) bits.push(esc(S.csvNote));
    M.csvnote.innerHTML = ICON.file + '<span>' + bits.join(" · ") + '</span>';
  }

  function renderTabs() {
    M.card.classList.toggle("is-csv", S.tab === "csv");
    Array.prototype.forEach.call(M.tabs.querySelectorAll("[data-tab]"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-tab") === S.tab);
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === S.tab ? "true" : "false");
    });
  }

  function renderAll() { renderTabs(); renderList(); renderTriggers(); renderCsvNote(); renderMenus(); }

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 132) + "px";
  }

  /* ---------------- build ---------------- */

  function build() {
    var back = document.createElement("div");
    /* up-root so core's theme sweep finds it, up-portal because it lives in <body> outside any
       component root -- setUpstreemTheme() looks for exactly those two. */
    back.className = "up-root up-portal up-topicmodal-backdrop uap-backdrop";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-label", "Add prompts");
    back.innerHTML =
      '<div class="up-topicmodal-card uap-card">' +
        '<div class="uap-head">' +
          '<div class="uap-heading">' +
            '<div class="uap-title">Add prompts</div>' +
            '<div class="uap-sub">Type them one by one, or import a spreadsheet.</div>' +
          '</div>' +
          '<button type="button" class="uap-close" data-act="close" aria-label="Close">' + ICON.x + '</button>' +
        '</div>' +

        '<div class="uap-tabs" role="tablist">' +
          '<button type="button" class="uap-tab" role="tab" data-tab="manual">Manual</button>' +
          '<button type="button" class="uap-tab" role="tab" data-tab="csv">Import CSV</button>' +
        '</div>' +

        '<div class="uap-input-manual">' +
          '<div class="uap-inputwrap">' +
            '<textarea class="uap-input" rows="2" placeholder="Type a prompt and press Enter"></textarea>' +
            /* The Enter affordance only exists while there is something to commit. An always-on
               button reads as "the primary action" and competes with Add; appearing on the first
               keystroke reads as "this is how you confirm", which is the whole point. */
            '<button type="button" class="uap-enter" data-act="commit" aria-label="Add this prompt" hidden>' +
              ICON.corner + '</button>' +
          '</div>' +
        '</div>' +

        '<div class="uap-input-csv">' +
          '<div class="uap-drop" tabindex="0">' +
            ICON.upload +
            /* Zwei Elemente, nicht ein Element mit eigenem Text neben einem <b>: ein Satz aus
               zwei Knoten laesst sich nicht uebersetzen (der Lauf schuetzt solche Bruchstuecke,
               seit daraus "Hinzufügen Prompts" wurde). So traegt jede Haelfte ihren eigenen
               Text und beide kommen aus dem Katalog. */
            '<div class="uap-droptext"><b>Drop a CSV here</b> <span>or click to choose a file</span></div>' +
            '<input type="file" class="uap-file" accept=".csv,text/csv" hidden>' +
          '</div>' +
          '<button type="button" class="uap-tmpl" data-act="template">' + ICON.download + 'Download template</button>' +
          '<div class="uap-csvnote" hidden></div>' +
        '</div>' +

        '<div class="uap-listwrap is-empty">' +
          '<div class="uap-listhead">' +
            '<span class="uap-listcount"></span>' +
            '<button type="button" class="uap-clearall" data-act="clearall">Clear all</button>' +
          '</div>' +
          '<ul class="uap-list"></ul>' +
          /* Kein Platzhalter mehr. Frueher standen hier zwei graue Balken plus die Ueberschrift
             "No prompts yet" -- eine Vorschau auf eine Liste, die es noch nicht gibt. Solange
             nichts eingetippt ist, ist der Dialog jetzt nur Eingabefeld und Fusszeile; der
             Listenbereich waechst erst, wenn er etwas zu zeigen hat. Das ist auch der Grund,
             warum das Aufgehen ueberhaupt animierbar wurde: von null auf die echte Hoehe ist
             eine Bewegung, von Platzhalter auf Inhalt waere nur ein Austausch gewesen. */
          '<div class="uap-capnote" hidden></div>' +
        '</div>' +

        /* Market and Topics sit IN the footer rather than as two more stacked blocks. §27's 32px
           gap between top-level blocks is right for a form; this dialog has six of them, and six
           32px gaps make a modal taller than most laptop screens before a single prompt is in it.
           Batch controls left, actions right is also what every bulk-add dialog worth copying does
           -- they modify what the button is about to do, so they belong next to it. */
        '<div class="uap-foot">' +
          /* Both pickers are the SAME control the markets and topics filters already use — the
             trigger with the chevron that turns into a clear-X on hover once something is picked,
             the core dropdown shell, core's search row, core's .up-filter-item rows with their
             checkbox. The first version invented all of that locally and looked foreign, and it
             also needed a separate clear-X button sitting awkwardly beside the trigger; in the
             established control the chevron IS the clear button. */
          '<div class="uap-meta">' +
            pickerHtml("market", ICON.pin, "Market", "Market for all new prompts") +
            pickerHtml("tags",   ICON.tag, "Topics", "Topics for all new prompts") +
          '</div>' +
          '<div class="uap-actions">' +
            '<button type="button" class="uap-cancel" data-act="close">Cancel</button>' +
            '<button type="button" class="uap-save" data-act="save" disabled>Add prompts</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(back);
    /* Vor dem ersten Anzeigen faerben, nicht danach -- siehe applyTheme(). */
    applyThemeOn(back);

    M = {
      back: back,
      card:       back.querySelector(".uap-card"),
      tabs:       back.querySelector(".uap-tabs"),
      input:      back.querySelector(".uap-input"),
      drop:       back.querySelector(".uap-drop"),
      file:       back.querySelector(".uap-file"),
      csvnote:    back.querySelector(".uap-csvnote"),
      listwrap:   back.querySelector(".uap-listwrap"),
      capnote:    back.querySelector(".uap-capnote"),
      list:       back.querySelector(".uap-list"),
      count:      back.querySelector(".uap-listcount"),
      enter:      back.querySelector(".uap-enter"),
      marketWrap:    back.querySelector('[data-pick="market"]'),
      marketTrigger: back.querySelector('[data-pick="market"] .uap-trigger'),
      tagsWrap:      back.querySelector('[data-pick="tags"]'),
      tagsTrigger:   back.querySelector('[data-pick="tags"] .uap-trigger'),
      save:       back.querySelector(".uap-save")
    };

    /* eventPrefix "uap-" so the DOM fallback event is uap-bubble_fn_uapAddPrompts on the modal
       root, in step with every other component's naming. */
    fire = UC.makeFire(back, "uap", { eventPrefix: "uap-" });

    /* Core's tooltip element lives in <body>. This dialog lives in the TOP LAYER, which is painted
       after the whole document -- so a body-mounted tip is behind the modal by construction, and no
       z-index can lift it, exactly the way no z-index could lift the modal above the host earlier.
       The tip has to be inside the same top-layer subtree, so this dialog runs its own. */
    if (UC.makeTooltips) {
      var prevTip = window.__upTipEl, prevState = window.__upTipState;
      window.__upTipEl = null; window.__upTipState = null;
      UC.makeTooltips(back, function () {
        return UC.getUpstreemTheme ? UC.getUpstreemTheme() === "dark" : false;
      });
      if (window.__upTipEl) back.appendChild(window.__upTipEl);
      window.__upTipEl = prevTip; window.__upTipState = prevState;
    }
    /* The stores fill in after the page's Run-JavaScript steps run, which can be after the modal
       was already built. Both pickers redraw on their own when that happens. */
    if (UC.onMarkets) UC.onMarkets(function () { if (M) { renderTriggers(); renderMenus(); } }, back);
    if (UC.onTopics)  UC.onTopics(function ()  { if (M) { renderTriggers(); renderMenus(); } }, back);
    if (UC.onTheme)   UC.onTheme(function ()   { if (M) renderAll(); }, back);

    wire();
    return back;
  }

  /* ---------------- behaviour ---------------- */

  function commitInput() {
    var v = M.input.value;
    if (!String(v).trim()) return;
    /* One prompt per line. Somebody pasting a column out of a spreadsheet expects exactly this,
       and typing a single prompt is unaffected because there is only one line. */
    var lines = String(v).split(/\r\n|\r|\n/).map(function (s) { return s.trim(); })
                         .filter(function (s) { return s; });
    addRows(lines.map(function (t) { return { text: t }; }));
    M.input.value = "";
    autosize(M.input);
    M.enter.hidden = true;
    renderList();
    M.list.scrollTop = M.list.scrollHeight;
  }

  function readFile(file) {
    if (!file) return;
    S.csvName = file.name || "";
    var fr = new FileReader();
    fr.onload = function () {
      var res;
      try { res = rowsFromCsv(decodeCsvBytes(fr.result)); }
      catch (e) { res = { rows: [], skipped: 0, note: "That file could not be read." }; }
      S.csvNote = res.note; S.csvSkipped = res.skipped;
      addRows(res.rows);
      if (!res.rows.length && !res.note) S.csvNote = "No usable rows found.";
      renderList(); renderCsvNote();
    };
    fr.onerror = function () {
      S.csvNote = "That file could not be read."; S.csvSkipped = 0;
      renderCsvNote();
    };
    fr.readAsArrayBuffer(file);
  }

  function closePick() { S.pick = null; S.pickQuery = ""; renderMenus(); }

  function wire() {
    var back = M.back;

    /* Backdrop click closes, card click does not. */
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });

    M.input.addEventListener("input", function () {
      autosize(M.input);
      M.enter.hidden = !String(M.input.value || "").trim();
    });
    M.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitInput(); }
    });

    M.drop.addEventListener("click", function () { M.file.click(); });
    M.drop.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); M.file.click(); }
    });
    M.file.addEventListener("change", function () {
      readFile(M.file.files && M.file.files[0]);
      M.file.value = "";                      // same file twice in a row must fire again
    });
    ["dragenter", "dragover"].forEach(function (t) {
      M.drop.addEventListener(t, function (e) { e.preventDefault(); M.drop.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (t) {
      M.drop.addEventListener(t, function (e) { e.preventDefault(); M.drop.classList.remove("is-over"); });
    });
    M.drop.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) readFile(f);
    });

    back.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-act]") : null;
      if (btn && back.contains(btn)) {
        var act = btn.getAttribute("data-act");
        if (act === "close")    { close(); return; }
        if (act === "template") { downloadCsv("upstreem-prompts-template.csv", templateCsv()); return; }
        if (act === "clearall") { S.rows = []; S.editing = null; renderList(); return; }
        if (act === "save")     { save(); return; }
        if (act === "commit")   { commitInput(); M.input.focus(); return; }
        if (act === "pick-market" || act === "pick-tags") {
          var want = act === "pick-market" ? "market" : "tags";
          /* Clicking the chevron area while something IS selected clears instead of opening --
             the chevron has already turned into an X under the cursor, so opening the menu would
             contradict what the button is showing. Same rule as the other three pickers. */
          if (e.target.closest(".uap-chev") && btn.parentNode.classList.contains("has-sel")) {
            if (want === "market") S.market = ""; else S.tags = {};
            S.pick = null; renderTriggers(); renderList(); renderMenus();
            return;
          }
          S.pick = S.pick === want ? null : want;
          S.pickQuery = "";
          renderMenus();
          return;
        }
        if (act === "edit" || act === "del") {
          var li = btn.closest(".uap-row"); if (!li) return;
          var id = li.getAttribute("data-id");
          if (act === "del") S.rows = S.rows.filter(function (r) { return r.id !== id; });
          else S.editing = id;
          renderList();
          return;
        }
      }
      var tab = e.target.closest ? e.target.closest("[data-tab]") : null;
      if (tab && back.contains(tab)) { S.tab = tab.getAttribute("data-tab"); closePick(); renderTabs(); return; }

      var sx = e.target.closest ? e.target.closest(".uap-search-x") : null;
      if (sx && back.contains(sx)) {
        e.stopPropagation();
        var sw = sx.closest(".up-ddsearch"), si = sw && sw.querySelector(".uap-search-in");
        S.pickQuery = "";
        if (si) si.value = "";
        if (sw) sw.classList.remove("has-text");
        renderMenus();
        if (si) { try { si.focus(); } catch (e2) {} }
        return;
      }

      var opt = e.target.closest ? e.target.closest(".uap-opt") : null;
      if (opt && back.contains(opt)) {
        var val = opt.getAttribute("data-val");
        if (S.pick === "market") { S.market = S.market === val ? "" : val; renderTriggers(); renderList(); renderMenus(); }
        else { if (S.tags[val]) delete S.tags[val]; else S.tags[val] = true; renderTriggers(); renderMenus(); }
        return;
      }
      /* A click anywhere else inside the card closes an open picker. */
      if (S.pick && !(e.target.closest && e.target.closest(".uap-menu"))) closePick();
    });

    back.addEventListener("input", function (e) {
      if (e.target.classList && e.target.classList.contains("uap-search-in")) {
        S.pickQuery = e.target.value;
        var wrap = e.target.closest(".up-ddsearch");
        if (wrap) wrap.classList.toggle("has-text", !!e.target.value.length);
        renderMenus();
      }
    });

    /* Inline row editing: blur or Enter commits, Escape drops the change. */
    M.list.addEventListener("keydown", function (e) {
      if (!e.target.classList.contains("uap-rowedit")) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.target.blur(); }
      if (e.key === "Escape") { e.preventDefault(); S.editing = null; renderList(); }
    });
    M.list.addEventListener("input", function (e) {
      if (e.target.classList.contains("uap-rowedit")) autosize(e.target);
    });
    M.list.addEventListener("blur", function (e) {
      if (!e.target.classList || !e.target.classList.contains("uap-rowedit")) return;
      var li = e.target.closest(".uap-row"); if (!li) return;
      var id = li.getAttribute("data-id"), v = String(e.target.value || "").trim();
      S.rows = S.rows.filter(function (r) {
        if (r.id !== id) return true;
        if (!v) return false;                 // emptied out means removed, which is what it looks like
        r.text = v; return true;
      });
      S.editing = null;
      renderList();
    }, true);

    document.addEventListener("keydown", function (e) {
      if (!M || !isOpen) return;
      if (e.key === "Escape") {
        if (S.pick) { closePick(); return; }
        close();
      }
    });
  }

  /* ---------------- the one event out ---------------- */

  function save() {
    if (!S.rows.length || S.saving) return;
    S.saving = true;
    M.save.disabled = true;
    M.card.classList.add("is-saving");

    var tags = selectedTagIds().join(",");
    var payload = {
      count: S.rows.length,
      /* Zwei Listen gleicher Laenge, index-aligned, und EIN Skalar. Verschachtelte Objekte wuerden
         einen JSON-String in den JSON-String legen; so etwas aus einem Bubble-Workflow zu lesen
         heisst bis zum Ende des Payloads zu matchen -- genau die Form, an der uptGroups zerbrochen
         ist (STYLEGUIDE 48). Flache Listen sind auch das, was prompt-research's
         acceptAllSuggestedPrompts schon uebergibt.

         prompt_texts und markets sind zu Recht Listen: der Text ist ohnehin pro Zeile, und der
         Markt kann es sein -- die CSV-Vorlage hat dafuer eine eigene Spalte, importierte Zeilen
         behalten ihren eigenen Markt und der Batch-Picker fuellt nur die Luecken.

         tag_ids ist bewusst KEINE Liste. Der Topics-Picker gilt fuer den ganzen Stapel, es gibt
         nirgends eine Quelle fuer zeilenweise Topics: nicht im Dialog, nicht in der CSV-Spalte.
         Vorher stand hier S.rows.map(function(){ return tags; }) -- eine Abbildung, die ihre
         Zeile nicht einmal entgegennahm und denselben String N-mal wiederholte. Das behauptet
         einen Zeilenbezug, den es nicht gibt, und zwingt die Gegenseite zu einer Extraktion, die
         das erste Element herausschneiden muss. Kommt eines Tages ein Editor fuer Topics pro
         Zeile, wird hier wieder eine Liste daraus -- dann aber mit echtem Grund. */
      prompt_texts: S.rows.map(function (r) { return r.text; }),
      markets:      S.rows.map(function (r) { return r.market || S.market || ""; }),
      tag_ids:      tags,
      /* Wie der Text in den Dialog kam -- getippt oder aus einer CSV. Das ist eine Eingabeart,
         keine Herkunft, und es steht deshalb in einem eigenen Feld: `source` kennt nur zwei
         gueltige Werte, und "csv" ist keiner davon. VOR source, damit source das letzte Feld des
         Payloads bleibt -- eine Extraktion, die bis zum Ende schneidet, bricht sonst. */
      input_method: S.tab === "csv" ? "csv" : "manual",
      /* Immer user_generated. Beides -- Tippen und CSV-Import -- ist vom Nutzer erstellt; der
         Unterschied zu ai_generated ist, WER den Text formuliert hat, nicht ueber welches Feld er
         hereinkam. Vorher stand hier "manual" bzw. "csv", also zwei Werte, die die Gegenseite
         ueberhaupt nicht kennt. */
      source:       "user_generated"
    };

    /* Through UC.makeFire, not by resolving the name here. makeFire is what prepends team_id, what
       resolves the name across parent/top and every reachable iframe, what warns exactly once when
       nothing picks the call up, and what dispatches the DOM event as a fallback. Calling
       resolveBubbleFn directly gets three of those and silently drops team_id -- which is how the
       first version of this function shipped a payload no other event in the app has. */
    fire("data-add-fn", "bubble_fn_uapAddPrompts", payload);

    /* Die Rueckmeldung kommt von hier, nicht aus einem Bubble-Workflow: der Dialog schliesst im
       naechsten Schritt, und ohne ein Wort dazu sieht das Verschwinden aus wie ein Abbruch.
       Derselbe Toast wie beim Kopieren in den Tabellen.
       Abgesichert wie marketsChanged darunter: liegt auf der Seite ein aelteres core.js (irgendeine
       Komponente mit altem data-cdn-pin gewinnt das Rennen), kennt es toast nicht. Ohne die
       Pruefung wuerde der TypeError den Rest dieser Funktion mitnehmen -- und damit close(). Der
       Dialog bliebe offen, obwohl die Prompts laengst gefeuert sind. */
    if (UC.toast) UC.toast(payload.count + " prompt" + (payload.count === 1 ? "" : "s") + " added", { icon: "check" });

    /* Adding prompts changes which markets the team has and how many prompts each holds, so the
       markets pickers have to be told (see the market store's comment in core.js). */
    if (UC.marketsChanged) { try { UC.marketsChanged(); } catch (e) {} }

    close();
  }

  /* ---------------- open / close ---------------- */

  function open(opts) {
    opts = opts || {};
    if (!M) build();
    S.rows = []; S.tags = {}; S.market = ""; S.editing = null; S.saving = false;
    S.csvNote = ""; S.csvSkipped = 0; S.csvName = ""; S.capNote = "";
    S.tab = opts.tab === "csv" ? "csv" : "manual";
    S.pick = null; S.pickQuery = "";
    /* Default market first, an explicit opts.market second. Both optional; neither is required
       for the dialog to work, the market just starts empty then. */
    if (DEFAULT_MARKET) S.market = DEFAULT_MARKET;
    if (opts.market) S.market = String(opts.market).toLowerCase();

    S.opener = document.activeElement;
    /* Das Theme JETZT setzen, nicht auf den nachlaufenden Sweep warten. Der Dialog haengt im
       <body>, ausserhalb jeder Komponentenwurzel -- data-theme kam bisher erst, wenn core's
       Theme-Beobachter den frischen Knoten bemerkt hatte. Bis dahin galt die Light-Palette, und
       im Dark Mode sah man fuer einen Moment einen sehr hellen Feldrahmen auf dunklem Grund.
       Dieselbe Zeile wie in UC.makeTopicModal, aus demselben Grund. */
    applyTheme();
    M.card.classList.remove("is-saving");
    isOpen = true;
    M.input.value = "";
    /* Both classes flip on THIS tick. Nothing here waits for a frame: the CSS in add-prompts.css
       animates over the visible resting state, so a throttled frame loop costs the fade, not the
       dialog. requestAnimationFrame was the first version and it deadlocked exactly that way. */
    showShell();
    renderAll(); renderMenus();
    setTimeout(function () { if (S.tab === "manual") M.input.focus(); }, 60);
  }

  function close() {
    if (!M || !isOpen) return;
    isOpen = false;
    /* Eine laufende Hoehenanimation abraeumen. Sonst traegt der Kasten beim naechsten Oeffnen die
       Inline-Hoehe von eben und der Dialog geht auf einer fremden Groesse auf. */
    clearTimeout(_lwTimer);
    if (M.listwrap) lwSettle(M.listwrap);
    closePick();
    hideShell();
    if (S.opener && S.opener.focus) { try { S.opener.focus(); } catch (e) {} }
    S.opener = null;
  }

  /* ---------------- public API ---------------- */

  window.openAddPrompts  = function (opts) { open(opts); };
  window.closeAddPrompts = function () { close(); };
  window.resetAddPrompts = function () {
    S.rows = []; S.tags = {}; S.market = ""; S.editing = null;
    S.csvNote = ""; S.csvSkipped = 0; S.csvName = ""; S.capNote = "";
    if (M) renderAll();
  };
  /* applyTheme() zusaetzlich, damit ein Themewechsel bei OFFENEM Dialog sofort greift und nicht
     erst, wenn core's Sweep den Portal-Knoten wieder erwischt. */
  window.setAddPromptsTheme = function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); applyTheme(); };
  /* The team's default market, as alpha-2. Prefills the picker every time the dialog opens; the
     user can still change or clear it, and that choice lasts for that one batch. */
  window.setUpstreemDefaultMarket = function (a2) {
    DEFAULT_MARKET = String(a2 == null ? "" : a2).trim().toLowerCase();
    window.__uapDefaultMarket = DEFAULT_MARKET;
  };

  /* Drain anything that was called before this file finished loading. */
  if (Q.length) {
    var pending = Q.splice(0, Q.length);
    pending.forEach(function (c) {
      var f = window[c[0]];
      if (typeof f === "function") { try { f.apply(null, c[1]); } catch (e) {} }
    });
  }

  /* Exposed for the local test harness only -- the CSV rules are the part of this file most
     likely to be changed later, and they are worth testing without a file picker. */
  window.__uapCsv = { parse: parseCsv, decode: decodeCsvBytes, detect: detectDelim,
                      rows: rowsFromCsv, template: templateCsv };
  }   /* Ende uapStart */

  uapBoot(30);
})();
