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
  var UC = window.UpstreemCore;
  if (!UC) { if (window.console) console.error("UpstreemCore (core.js) not loaded"); return; }

  var esc = UC.esc, toNum = UC.toNum;

  /* ---- boot stubs (STYLEGUIDE §25) --------------------------------------------------------
     Bubble fires workflows before this file finishes loading. openAddPrompts in particular is
     wired to a button the user can hit during the first second of a page's life. */
  var API_NAMES = ["openAddPrompts", "closeAddPrompts", "resetAddPrompts", "setAddPromptsTheme"];
  var Q = (window.__uapBootQueue = window.__uapBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  var ICON = {
    /* All Feather, taken from the set. */
    x:       '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    plus:    '<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    edit:    '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    upload:  '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    download:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    pin:     '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    tag:     '<svg viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
    search:  '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    alert:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    file:    '<svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>'
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
    var lines = [
      ["prompt_text", "market"],
      ["Wer bietet Schulungen zur digitalen Prozessautomatisierung für Handwerker an?", "de"],
      ["Which tools help small manufacturers automate quoting?", "us"],
      ["Welche Anbieter für Werkstattsoftware sind empfehlenswert?", ""]
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
    if (!grid.length) return { rows: [], skipped: 0, note: "Die Datei enthält keine Zeilen." };

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
      note = "Keine Kopfzeile erkannt, erste Spalte als Prompt gelesen.";
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
  var S = {
    tab: "manual",              // "manual" | "csv"
    rows: [],                   // [{ id, text, market }]
    tags: {},                   // batch topics, id -> true
    market: "",                 // batch market (alpha2), applied to rows without one
    csvNote: "", csvSkipped: 0, csvName: "",
    editing: null,              // row id being edited inline
    pick: null,                 // null | "market" | "tags"
    pickQuery: "",
    saving: false,
    opener: null                // element to restore focus to on close
  };
  var seq = 0;

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
  function topicHex(t) {
    var dark = UC.getUpstreemTheme ? UC.getUpstreemTheme() === "dark" : false;
    return (dark ? t.hex_dark : t.hex_light) || t.hex_light || t.hex_dark || "#808080";
  }
  function selectedTagIds() {
    return Object.keys(S.tags).filter(function (k) { return S.tags[k]; });
  }

  function addRows(list) {
    list.forEach(function (r) {
      var t = String(r.text == null ? "" : r.text).trim();
      if (!t) return;
      S.rows.push({ id: "r" + (++seq), text: t, market: r.market || "" });
    });
  }

  /* ---------------- markup ---------------- */

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

  function renderList() {
    var el = M.list;
    if (!S.rows.length) {
      el.innerHTML = "";
      M.listwrap.classList.add("is-empty");
    } else {
      M.listwrap.classList.remove("is-empty");
      el.innerHTML = S.rows.map(rowHtml).join("");
    }
    M.count.textContent = S.rows.length
      ? S.rows.length + (S.rows.length === 1 ? " prompt" : " prompts")
      : "No prompts yet";
    M.save.disabled = !S.rows.length || S.saving;
    M.save.textContent = S.rows.length ? "Add " + S.rows.length + (S.rows.length === 1 ? " prompt" : " prompts")
                                       : "Add prompts";
    var ed = el.querySelector(".uap-rowedit");
    if (ed) { autosize(ed); ed.focus(); ed.setSelectionRange(ed.value.length, ed.value.length); }
  }

  function renderPickers() {
    var mk = S.market;
    M.marketBtn.innerHTML = mk
      ? '<img class="uap-flag" src="' + esc(flagUrl(mk)) + '" alt="">' +
        '<span class="uap-picklabel">' + esc(marketName(mk)) + '</span>'
      : ICON.pin + '<span class="uap-picklabel is-empty">Market</span>';
    M.marketBtn.classList.toggle("is-set", !!mk);
    M.marketClear.hidden = !mk;

    var ids = selectedTagIds();
    if (!ids.length) {
      M.tagsBtn.innerHTML = ICON.tag + '<span class="uap-picklabel is-empty">Topics</span>';
      M.tagsBtn.classList.remove("is-set");
    } else {
      M.tagsBtn.classList.add("is-set");
      M.tagsBtn.innerHTML = ids.slice(0, 3).map(function (id) {
        var t = topicById(id);
        if (!t) return "";
        var mark = t.emoji ? '<span class="uap-tagemoji">' + esc(t.emoji) + '</span>'
                           : '<span class="uap-tagdot" style="background:' + esc(topicHex(t)) + '"></span>';
        return '<span class="uap-tagchip">' + mark + esc(t.name || "") + '</span>';
      }).join("") + (ids.length > 3 ? '<span class="uap-tagmore">+' + (ids.length - 3) + '</span>' : "");
    }
    M.tagsClear.hidden = !ids.length;
  }

  function pickMenuHtml() {
    var q = S.pickQuery.toLowerCase();
    if (S.pick === "market") {
      var list = (UC.getMarkets ? UC.getMarkets() : []).filter(function (m) {
        if (!q) return true;
        return String(m.name || "").toLowerCase().indexOf(q) >= 0 ||
               String(m.alpha2 || "").toLowerCase().indexOf(q) >= 0;
      });
      if (!list.length) return '<div class="uap-pickempty">No markets found</div>';
      return list.map(function (m) {
        var a2 = String(m.alpha2 || "").toLowerCase();
        return '<button type="button" class="up-optrow uap-pickopt' + (a2 === S.market ? " is-on" : "") +
               '" data-val="' + esc(a2) + '">' +
                 '<img class="uap-flag" src="' + esc(flagUrl(a2)) + '" alt="">' +
                 '<span class="uap-pickopt-name">' + esc(m.name || a2.toUpperCase()) + '</span>' +
                 '<span class="up-optrow-check">' + UC.CHECK_SVG + '</span>' +
               '</button>';
      }).join("");
    }
    var tl = (UC.getTopics ? UC.getTopics() : []).filter(function (t) {
      if (t.is_active === false) return false;
      return !q || String(t.name || "").toLowerCase().indexOf(q) >= 0;
    });
    if (!tl.length) return '<div class="uap-pickempty">No topics found</div>';
    return tl.map(function (t) {
      var on = !!S.tags[t.id];
      var mark = t.emoji ? '<span class="uap-tagemoji">' + esc(t.emoji) + '</span>'
                         : '<span class="uap-tagdot" style="background:' + esc(topicHex(t)) + '"></span>';
      return '<button type="button" class="up-optrow uap-pickopt' + (on ? " is-on" : "") +
             '" data-val="' + esc(t.id) + '">' + mark +
               '<span class="uap-pickopt-name">' + esc(t.name || "") + '</span>' +
               '<span class="up-optrow-check">' + UC.CHECK_SVG + '</span>' +
             '</button>';
    }).join("");
  }

  function renderPickMenu() {
    if (!S.pick) { M.pick.hidden = true; M.pick.innerHTML = ""; return; }
    M.pick.hidden = false;
    M.pick.className = "uap-pickmenu is-" + S.pick;
    M.pick.innerHTML =
      '<div class="uap-picksearch">' + ICON.search +
        '<input type="text" placeholder="' + (S.pick === "market" ? "Search markets" : "Search topics") +
        '" value="' + esc(S.pickQuery) + '">' +
      '</div>' +
      '<div class="uap-picklist">' + pickMenuHtml() + '</div>';
    var inp = M.pick.querySelector("input");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }

  function renderCsvNote() {
    if (!S.csvNote && !S.csvSkipped && !S.csvName) { M.csvnote.hidden = true; return; }
    M.csvnote.hidden = false;
    var bits = [];
    if (S.csvName) bits.push(esc(S.csvName));
    if (S.csvSkipped) bits.push(S.csvSkipped + (S.csvSkipped === 1 ? " Zeile übersprungen" : " Zeilen übersprungen"));
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

  function renderAll() { renderTabs(); renderList(); renderPickers(); renderCsvNote(); }

  function autosize(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 132) + "px";
  }

  /* ---------------- build ---------------- */

  function build() {
    var back = document.createElement("div");
    /* up-root so core's theme sweep finds it, up-portal because it lives in <body> outside any
       component root -- setUpstreemTheme() looks for exactly those two. */
    back.className = "up-root up-portal uap-backdrop";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");
    back.setAttribute("aria-label", "Add prompts");
    back.innerHTML =
      '<div class="uap-card">' +
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
          '<textarea class="uap-input" rows="1" placeholder="Type a prompt and press Enter"></textarea>' +
          '<div class="uap-hint">Enter adds it to the list · Shift+Enter for a line break · paste several lines to add them all</div>' +
        '</div>' +

        '<div class="uap-input-csv">' +
          '<div class="uap-drop" tabindex="0">' +
            ICON.upload +
            '<div class="uap-droptext"><b>Drop a CSV here</b> or click to choose a file</div>' +
            '<input type="file" class="uap-file" accept=".csv,text/csv" hidden>' +
          '</div>' +
          '<button type="button" class="uap-tmpl" data-act="template">' + ICON.download + 'Download template</button>' +
          '<div class="uap-csvnote" hidden></div>' +
        '</div>' +

        '<div class="uap-listwrap is-empty">' +
          '<div class="uap-listhead">' +
            '<span class="uap-count">No prompts yet</span>' +
            '<button type="button" class="uap-clearall" data-act="clearall">Clear all</button>' +
          '</div>' +
          '<ul class="uap-list"></ul>' +
          '<div class="uap-listempty">Prompts you add show up here before anything is saved.</div>' +
        '</div>' +

        /* Market and Topics sit IN the footer rather than as two more stacked blocks. §27's 32px
           gap between top-level blocks is right for a form; this dialog has six of them, and six
           32px gaps make a modal taller than most laptop screens before a single prompt is in it.
           Batch controls left, actions right is also what every bulk-add dialog worth copying does
           -- they modify what the button is about to do, so they belong next to it. */
        '<div class="uap-foot">' +
          '<div class="uap-meta">' +
            '<div class="uap-pickwrap">' +
              '<button type="button" class="uap-pickbtn" data-act="pick-market" data-tip="Market for all new prompts"></button>' +
              '<button type="button" class="uap-pickclear" data-act="clear-market" data-tip="Clear market" hidden>' + ICON.x + '</button>' +
            '</div>' +
            '<div class="uap-pickwrap">' +
              '<button type="button" class="uap-pickbtn" data-act="pick-tags" data-tip="Topics for all new prompts"></button>' +
              '<button type="button" class="uap-pickclear" data-act="clear-tags" data-tip="Clear topics" hidden>' + ICON.x + '</button>' +
            '</div>' +
            '<div class="uap-pickmenu" hidden></div>' +
          '</div>' +
          '<div class="uap-actions">' +
            '<button type="button" class="uap-cancel" data-act="close">Cancel</button>' +
            '<button type="button" class="uap-save" data-act="save" disabled>Add prompts</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(back);

    M = {
      back: back,
      card:       back.querySelector(".uap-card"),
      tabs:       back.querySelector(".uap-tabs"),
      input:      back.querySelector(".uap-input"),
      drop:       back.querySelector(".uap-drop"),
      file:       back.querySelector(".uap-file"),
      csvnote:    back.querySelector(".uap-csvnote"),
      listwrap:   back.querySelector(".uap-listwrap"),
      list:       back.querySelector(".uap-list"),
      count:      back.querySelector(".uap-count"),
      marketBtn:  back.querySelector('[data-act="pick-market"]'),
      marketClear:back.querySelector('[data-act="clear-market"]'),
      tagsBtn:    back.querySelector('[data-act="pick-tags"]'),
      tagsClear:  back.querySelector('[data-act="clear-tags"]'),
      pick:       back.querySelector(".uap-pickmenu"),
      save:       back.querySelector(".uap-save")
    };

    /* eventPrefix "uap-" so the DOM fallback event is uap-bubble_fn_uapAddPrompts on the modal
       root, in step with every other component's naming. */
    fire = UC.makeFire(back, "uap", { eventPrefix: "uap-" });

    if (UC.makeTooltips) UC.makeTooltips(back, function () {
      return UC.getUpstreemTheme ? UC.getUpstreemTheme() === "dark" : false;
    });
    /* The stores fill in after the page's Run-JavaScript steps run, which can be after the modal
       was already built. Both pickers redraw on their own when that happens. */
    if (UC.onMarkets) UC.onMarkets(function () { if (M) { renderPickers(); if (S.pick === "market") renderPickMenu(); } }, back);
    if (UC.onTopics)  UC.onTopics(function ()  { if (M) { renderPickers(); if (S.pick === "tags")   renderPickMenu(); } }, back);
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
      catch (e) { res = { rows: [], skipped: 0, note: "Die Datei konnte nicht gelesen werden." }; }
      S.csvNote = res.note; S.csvSkipped = res.skipped;
      addRows(res.rows);
      if (!res.rows.length && !res.note) S.csvNote = "Keine verwertbaren Zeilen gefunden.";
      renderList(); renderCsvNote();
    };
    fr.onerror = function () {
      S.csvNote = "Die Datei konnte nicht gelesen werden."; S.csvSkipped = 0;
      renderCsvNote();
    };
    fr.readAsArrayBuffer(file);
  }

  function closePick() { S.pick = null; S.pickQuery = ""; renderPickMenu(); }

  function wire() {
    var back = M.back;

    /* Backdrop click closes, card click does not. */
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });

    M.input.addEventListener("input", function () { autosize(M.input); });
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
        if (act === "clear-market") { S.market = ""; renderPickers(); renderList(); return; }
        if (act === "clear-tags")   { S.tags = {}; renderPickers(); return; }
        if (act === "pick-market" || act === "pick-tags") {
          var want = act === "pick-market" ? "market" : "tags";
          S.pick = S.pick === want ? null : want;
          S.pickQuery = "";
          renderPickMenu();
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

      var opt = e.target.closest ? e.target.closest(".uap-pickopt") : null;
      if (opt && back.contains(opt)) {
        var val = opt.getAttribute("data-val");
        if (S.pick === "market") { S.market = S.market === val ? "" : val; renderPickers(); renderList(); renderPickMenu(); }
        else { if (S.tags[val]) delete S.tags[val]; else S.tags[val] = true; renderPickers(); renderPickMenu(); }
        return;
      }
      /* A click anywhere else inside the card closes an open picker. */
      if (S.pick && !(e.target.closest && e.target.closest(".uap-pickmenu"))) closePick();
    });

    M.pick.addEventListener("input", function (e) {
      if (e.target.tagName === "INPUT") { S.pickQuery = e.target.value; renderPickMenu(); }
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
      if (!M || M.back.hidden) return;
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
      /* Three arrays of the SAME length, index-aligned. Nested objects would put a JSON string
         inside a JSON string, and reading one of those out of a Bubble workflow means matching to
         the end of the payload -- the exact shape that broke uptGroups (STYLEGUIDE §48). Flat
         arrays are what prompt-research's acceptAllSuggestedPrompts already hands over. */
      prompt_texts: S.rows.map(function (r) { return r.text; }),
      markets:      S.rows.map(function (r) { return r.market || S.market || ""; }),
      tag_ids:      S.rows.map(function () { return tags; }),
      source:       S.tab === "csv" ? "csv" : "manual"
    };

    /* Through UC.makeFire, not by resolving the name here. makeFire is what prepends team_id, what
       resolves the name across parent/top and every reachable iframe, what warns exactly once when
       nothing picks the call up, and what dispatches the DOM event as a fallback. Calling
       resolveBubbleFn directly gets three of those and silently drops team_id -- which is how the
       first version of this function shipped a payload no other event in the app has. */
    fire("data-add-fn", "bubble_fn_uapAddPrompts", payload);

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
    S.csvNote = ""; S.csvSkipped = 0; S.csvName = "";
    S.tab = opts.tab === "csv" ? "csv" : "manual";
    S.pick = null; S.pickQuery = "";
    if (opts.market) S.market = String(opts.market).toLowerCase();

    S.opener = document.activeElement;
    M.card.classList.remove("is-saving");
    M.back.hidden = false;
    M.input.value = "";
    /* Both classes flip on THIS tick. Nothing here waits for a frame: the CSS in add-prompts.css
       animates over the visible resting state, so a throttled frame loop costs the fade, not the
       dialog. requestAnimationFrame was the first version and it deadlocked exactly that way. */
    M.back.classList.remove("is-closing");
    M.back.classList.add("is-open");
    renderAll(); renderPickMenu();
    setTimeout(function () { if (S.tab === "manual") M.input.focus(); }, 60);
  }

  function close() {
    if (!M || M.back.hidden) return;
    closePick();
    M.back.classList.remove("is-open");
    M.back.classList.add("is-closing");
    /* The timeout is the authority on being gone, not the animation's end event: if the exit
       animation never runs, animationend never fires and the dialog would stay on screen. */
    var el = M.back;
    setTimeout(function () { el.hidden = true; el.classList.remove("is-closing"); }, 160);
    if (S.opener && S.opener.focus) { try { S.opener.focus(); } catch (e) {} }
    S.opener = null;
  }

  /* ---------------- public API ---------------- */

  window.openAddPrompts  = function (opts) { open(opts); };
  window.closeAddPrompts = function () { close(); };
  window.resetAddPrompts = function () {
    S.rows = []; S.tags = {}; S.market = ""; S.editing = null;
    S.csvNote = ""; S.csvSkipped = 0; S.csvName = "";
    if (M) renderAll();
  };
  window.setAddPromptsTheme = function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); };

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
})();
