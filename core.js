/* upstreem core.js — geteilte Daten + Utilities fuer alle Tabellen-/Chart-Komponenten.
   Vor jeder Komponente laden; stellt window.UpstreemCore bereit. Event-Namen bleiben pro Komponente. */
(function(){
  "use strict";

  var CITE_COLOR = {
    "Editorial":"#27a79b", "UGC / Community":"#34a1d1", "Knowledge-Base":"#797ad8",
    "Brand Platforms":"#bc69c9", "Institutional":"#5e7eac", "Competition":"#dd7e3e", "You":"#d35f73"
  };
  var CITE_ALIAS = {
    "Brand_Platform":"Brand Platforms", "Brand Platform":"Brand Platforms",
    "Knowledge_Base":"Knowledge-Base", "Knowledge Base":"Knowledge-Base",
    "UGC_Community":"UGC / Community", "UGC Community":"UGC / Community"
  };
  var ALL_CITATION_TYPES = ["Editorial","UGC_Community","Knowledge_Base","Brand_Platform","Institutional","Competition","You"];
  /* URL types: canonical palette, copied 1:1 from the standalone URL Type chip component.
     Unlike citation types these DO have a real dark variant. */
  var URL_TYPE = {
    homepage:        { label:"Homepage",         c:"#b45309", cDark:"#fbbf24" },
    product_service: { label:"Product / Service", c:"#c2683b", cDark:"#fdba74" },
    marketplace:     { label:"Marketplace",      c:"#9a5b2e", cDark:"#fcae6f" },
    company_info:    { label:"Company Info",     c:"#a16207", cDark:"#facc15" },
    article:         { label:"Article",          c:"#047857", cDark:"#6ee7b7" },
    listicle:        { label:"Listicle",         c:"#0e7490", cDark:"#67e8f9" },
    guide:           { label:"Guide",            c:"#2563eb", cDark:"#93c5fd" },
    comparison:      { label:"Comparison",       c:"#4f46e5", cDark:"#a5b4fc" },
    review:          { label:"Review",           c:"#6d28d9", cDark:"#c4b5fd" },
    documentation:   { label:"Documentation",    c:"#6d28d9", cDark:"#c4b5fd" },
    forum:           { label:"Forum",            c:"#9333ea", cDark:"#d8b4fe" },
    directory:       { label:"Directory",        c:"#a21caf", cDark:"#f0abfc" },
    video:           { label:"Video",            c:"#7c3aed", cDark:"#c4b5fd" },
    social_post:     { label:"Social Post",      c:"#8b5cf6", cDark:"#ddd6fe" }
  };
  var ALL_URL_TYPES = Object.keys(URL_TYPE);
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a8abb2", CHIP_BG_DARK = "#242424";
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  /* Search behaviour lifted verbatim from quick_actions.html so both feel identical. */
  var DEBOUNCE = 400, MIN = 2;
  /* Sort coalescing window. Shorter than search: a click is a deliberate act, so the result
     has to feel immediate, but it is long enough to swallow a burst of clicks. */
  var SORT_DEBOUNCE = 250;
  var PAGE_SIZES = [15, 25, 50, 100];

  var DEFAULT_PAGE_SIZE = 15;
  /* Compact count format shared with the other components: 1.23k / 12.3k / 1.2m */
  function fmtTotal(n){
    n = Number(n) || 0;
    if (n < 1000) return String(Math.round(n));
    var k = n / 1000;
    if (n < 10000) return (Math.round(k * 100) / 100).toFixed(2).replace(/0+$/,"").replace(/\.$/,"") + "k";
    if (n < 1000000) return (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/,"") + "k";
    return (Math.round((n/1000000) * 10) / 10).toFixed(1).replace(/\.0$/,"") + "m";
  }

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }
  /* Wraps every occurrence of the active query in <mark>. Escapes FIRST, then inserts the
     markup — doing it the other way round would let a crafted domain inject HTML. */
  function highlight(text, q){
    var safe = esc(text);
    q = String(q == null ? "" : q).trim();
    if (!q) return safe;
    var needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return safe.replace(new RegExp("(" + needle + ")", "ig"), '<mark class="up-hl">$1</mark>'); }
    catch(e){ return safe; }
  }
  /* ---------- Reddit URL → readable title ----------
     RPC-supplied titles for Reddit results are usually just the scraped page <title>, which for
     Reddit is almost always the literal string "reddit.com" — useless as a row label. The comment
     ID in the URL's own path is more informative than that: r/<subreddit> always exists, and the
     slug segment right after the ID (when Reddit's own link included one — it doesn't always,
     e.g. a bare .../comments/1k1eu6a with no trailing words) is the post's own title with spaces
     swapped for underscores and non-ASCII percent-encoded. Old/new/mobile/no-participation
     subdomains (old./m./np.) all share this same path shape. A REAL scraped title (anything other
     than the bare domain) always wins over this — parsing is only the fallback for the common
     "reddit.com" case. */
  var REDDIT_URL_RE = /^https?:\/\/(?:[a-z0-9-]+\.)?reddit\.com\/r\/([A-Za-z0-9_]+)\/comments\/[a-z0-9]+(?:\/([^\/?#]+))?/i;
  function parseRedditUrl(url){
    var m = REDDIT_URL_RE.exec(String(url == null ? "" : url));
    if (!m) return null;
    var slug = null;
    if (m[2]){
      var raw = m[2];
      try { raw = decodeURIComponent(raw); } catch(e){}
      raw = raw.replace(/_/g, " ").trim();
      if (raw) slug = raw.charAt(0).toUpperCase() + raw.slice(1);
    }
    return { sub: m[1], slug: slug };
  }
  /* "No real title" means empty, or exactly the URL's own hostname — the scraped-<title> sentinel
     Reddit produces for the vast majority of links (also covers a title that's literally the raw
     URL, which some callers already fall back to when the RPC sends nothing at all). */
  function isGenericUrlTitle(title, url){
    var t = String(title == null ? "" : title).trim().toLowerCase();
    if (!t || t === String(url == null ? "" : url).trim().toLowerCase()) return true;
    try { return t === new URL(String(url)).hostname.replace(/^www\./, "").toLowerCase(); }
    catch(e){ return false; }
  }
  /* Returns HTML (r/sub, then a muted "/", then the parsed slug when Reddit's own link had one)
     or null when this isn't a Reddit URL / a real title already exists — null means "render your
     normal title the usual way", not "render nothing". `q` is the caller's active search query,
     highlighted exactly like every other title cell so a Reddit result found via search still
     shows its match. */
  function redditTitleHtml(url, title, q){
    if (!isGenericUrlTitle(title, url)) return null;
    var parsed = parseRedditUrl(url);
    if (!parsed) return null;
    var out = '<span class="up-reddit-sub">' + highlight("r/" + parsed.sub, q) + '</span>';
    if (parsed.slug){
      out += ' <span class="up-reddit-sep">/</span> ' + highlight(parsed.slug, q);
    }
    return out;
  }
  /* ---------- parseBubbleJson ----------
     Bubble's ":formatted as text" output is JSON-SHAPED but not valid JSON: several field types
     come through unquoted — booleans as the bare words yes/no ("yes is not defined") and emoji as
     a bare glyph ("emoji": 💎 -> "Invalid or unexpected token"). This walks the text once,
     tracking whether it is inside a quoted string, and quotes every bare value found outside one.

     Deliberately a scanner and not a regex: a timestamp like "May 9, 2026 12:23 pm" contains BOTH
     a comma and a colon inside its own quotes, and a regex has no way to know it must keep its
     hands off. An earlier regex version broke exactly that case.

     Lives in core because more than one caller needs it — every Run-JS step that feeds a
     component the raw RPC text. Two copies of this is how the emoji bug survived a round of
     fixes: only one of them got repaired. */
  function parseBubbleJson(raw){
    var src = String(raw == null ? "" : raw).trim();
    if (!src) return [];
    if (src.charAt(0) === "{") src = "[" + src + "]";
    var out = "", i = 0, n = src.length, inStr = false, esc2 = false, ch, c, start, v;
    while (i < n){
      ch = src.charAt(i);
      if (inStr){
        out += ch;
        if (esc2) esc2 = false;
        else if (ch === "\\") esc2 = true;
        else if (ch === '"'){
          /* Bubble's text fields (titles, descriptions) sometimes carry a literal, un-escaped
             quote of their own — e.g. a description containing von "Meine Top 3" geht. Blindly
             toggling inStr off at THAT quote corrupts every field after it. A real closing quote
             here is always followed (after whitespace) by one of , } ] : or the end of the text;
             anything else is content, not a terminator — keep scanning and escape it instead. */
          var peek = i + 1;
          while (peek < n && /\s/.test(src.charAt(peek))) peek++;
          var after = peek < n ? src.charAt(peek) : "";
          if (after === "" || after === "," || after === "}" || after === "]" || after === ":"){
            inStr = false;
          } else {
            out = out.slice(0, -1) + '\\"';
          }
        }
        i++; continue;
      }
      if (ch === '"'){ inStr = true; out += ch; i++; continue; }
      if (ch !== ":"){ out += ch; i++; continue; }

      out += ch; i++;                                     // the colon itself
      while (i < n && /\s/.test(src.charAt(i))){ out += src.charAt(i); i++; }
      if (i >= n) break;
      c = src.charAt(i);
      if (c === '"' || c === "[" || c === "{") continue;   // already quoted or structured

      start = i;
      while (i < n && src.charAt(i) !== "," && src.charAt(i) !== "}" && src.charAt(i) !== "]") i++;
      v = src.slice(start, i).replace(/^\s+|\s+$/g, "");
      if (v === ""){ out += "null"; continue; }
      if (v === "true" || v === "false" || v === "null"){ out += v; continue; }
      if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v)){ out += v; continue; }
      if (/^yes$/i.test(v)){ out += "true"; continue; }
      if (/^no$/i.test(v)){ out += "false"; continue; }
      out += '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    out = out.replace(/,\s*([}\]])/g, "$1");              // trailing comma before a closer
    var parsed;
    try { parsed = eval("(" + out + ")"); }
    catch(e){
      if (window.console) console.warn("[UpstreemCore] parseBubbleJson failed:", e.message, raw);
      return [];
    }
    if (typeof parsed === "string"){                      // Bubble sometimes double-encodes
      try { return parseBubbleJson(parsed); } catch(e2){ return []; }
    }
    if (parsed && !Array.isArray(parsed) && typeof parsed === "object") return [parsed];
    return Array.isArray(parsed) ? parsed : [];
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c];
    });
  }
  function citeName(raw){
    if (!raw) return "";
    var s = String(raw).trim();
    if (CITE_ALIAS[s]) return CITE_ALIAS[s];
    if (/^Brand\s+Platforms?$/i.test(s)) return "Brand Platforms";
    if (/^Knowledge[-\s_]?Base$/i.test(s)) return "Knowledge-Base";
    if (/^UGC(\s*[\/_]?\s*Community)?$/i.test(s)) return "UGC / Community";
    return s;
  }
  function tint(hex, a){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
  }
  /* Blends a hex colour toward white by `amt` (0-1) — the doughnut's hover state (see
     makeTypeChart's hoverBackgroundColor). Bars get the visually equivalent effect via a CSS
     `filter: brightness()` on their own fill instead (their colour is an inline style, not a
     canvas fill core can intercept), so the two chart types read as the same hover language
     without sharing implementation. */
  function brighten(hex, amt){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    r = Math.round(r + (255-r)*amt); g = Math.round(g + (255-g)*amt); b = Math.round(b + (255-b)*amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  /* Same idea as brighten(), toward black instead — the DIM/grey slices' own hover state (see
     makeTypeChart). A dim slice's colour is already a light neutral grey; blending IT toward
     white on hover made the hovered slice read as nearly-white instead of "a bit darker than
     resting", which is what a hover on an already-muted element should look like. */
  function darken(hex, amt){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    var r = (n>>16)&255, g = (n>>8)&255, b = n&255;
    r = Math.round(r * (1-amt)); g = Math.round(g * (1-amt)); b = Math.round(b * (1-amt));
    return "rgb(" + r + "," + g + "," + b + ")";
  }
  /* Number(null) is 0 and Number("") is 0 — both would otherwise sail through as valid numbers
     here, turning "no value" into a fake zero everywhere toNum feeds fmt1/fmtInt (found via a
     null avg_rank rendering "0.0" instead of "–" in prompts-table; the same bug was latent
     wherever else a nullable numeric field went through this path). */
  function toNum(v){
    if (v == null || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function fmt1(v){ var n = toNum(v); return n == null ? "–" : (Math.round(n * 10) / 10).toFixed(1); }
  function fmtInt(v){ var n = toNum(v); return n == null ? "–" : String(Math.round(n)); }
  /* App-wide date format: "24. Jul 2026". Parses the RPC's ISO timestamps; anything
     unparseable renders as an em dash rather than "Invalid Date". */
  function fmtDate(v){
    if (v == null || v === "") return "–";
    var d = new Date(String(v));
    if (isNaN(d.getTime())) return "–";
    return String(d.getDate()).padStart(2, "0") + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function foldDiacritics(s){
    var t = String(s == null ? "" : s);
    try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e){}
    return t.replace(/ß/g, "ss").toLowerCase();
  }
  function germanExpand(s){
    return String(s == null ? "" : s)
      .replace(/Ä/g,"Ae").replace(/Ö/g,"Oe").replace(/Ü/g,"Ue")
      .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
      .toLowerCase();
  }
  function resolveBubbleFn(fnName){
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

  var TREND_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var TREND_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var COPY_SVG = '<svg class="up-ic-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var GOTO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var HASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';
  var DONE_SVG = '<svg class="up-ic-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var EXT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  /* ==========================================================================================
     TABLE PRIMITIVES
     ==========================================================================================
     The four tables in this library legitimately differ in their columns, heights and row
     content — that stays per component. What did NOT need to differ, but was copy-pasted anyway,
     is everything below: the trend chip (4 copies), the loading skeleton rows (4), the 3000ms
     empty-state grace timer (5), and the column-explainer popover logic (3). */

  /* Delta chip: an arrow plus the absolute value, coloured by whether the change is GOOD, which
     is not the same as whether it went up — for a ranking, down is good. Hence `inverted`.
     Returns "" for null/NaN/rounds-to-zero, so callers can concatenate it unconditionally.
     opts: { decimals, inverted, suffix, cls } */
  function trendChip(delta, opts){
    opts = opts || {};
    if (delta == null || delta === "") return "";
    var d = Number(delta);
    if (!isFinite(d)) return "";
    var shown = opts.decimals ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d));
    if (shown === 0) return "";                       // "+0%" is noise, not information
    var goingUp = d > 0;
    var positive = opts.inverted ? !goingUp : goingUp;
    var txt = (opts.decimals ? shown.toFixed(1) : String(shown)) + (opts.suffix || "");
    return '<span class="' + (opts.cls || "up-trend") + " " + (positive ? "pos" : "neg") + '">' +
      (goingUp ? TREND_UP : TREND_DOWN) + txt + '</span>';
  }

  /* Colour for a 0-100 sentiment score: red -> orange -> grey -> light green -> green.
     Shared by visibility-chart's Top Brands table and prompts-table's Sentiment column —
     both need the exact same thresholds, not just a similar-looking scale. */
  function sentColor(v){
    v = Number(v);
    if (v <= 25) return "#D25D5D";
    if (v <= 40) return "#D2865D";
    if (v <= 60) return "#9E9E9E";
    if (v <= 75) return "#9FD25D";
    return "#60D25D";
  }

  /* Brand-mention chip stack: overlapping favicon circles + "+N" overflow. Shared by urls-table
     and prompts-table's Brand Mentions column — same chips, same hover-lift, same overflow math.
     mentions: [{name, favicon_url|favicon}, ...] — the RPC sends only a preview; totalCount
     carries the real count so "+N" is correct even when the preview happens to be exactly full.
     opts: { max } (default 4) */
  function brandStack(mentions, totalCount, opts){
    opts = opts || {};
    var MAX = opts.max || 4;
    var list = Array.isArray(mentions) ? mentions : [];
    if (!list.length) return '<span class="up-stack-empty">-</span>';
    var shown = list.slice(0, MAX);
    var total = toNum(totalCount);
    if (total == null || total < list.length) total = list.length;
    var rest = total - shown.length;
    var html = shown.map(function(m){
      var nm = String(m && m.name != null ? m.name : "");
      var logo = String(m && (m.favicon_url != null ? m.favicon_url : (m.favicon != null ? m.favicon : "")) || "");
      // protocol-relative urls ("//cdn...") break inside some Bubble contexts
      if (logo.indexOf("//") === 0) logo = "https:" + logo;
      var initial = nm.charAt(0) || "?";
      return '<span class="up-stack-item' + (logo ? " has-img" : "") + '" data-brandtip="' + esc(nm) + '">' +
               '<span class="up-stack-vis">' +
                 '<span class="up-stack-ltr">' + esc(initial) + '</span>' +
                 (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                         ' onerror="this.closest(\'.up-stack-item\').classList.remove(\'has-img\'); this.remove()"/>' : "") +
               '</span>' +
             '</span>';
    }).join("");
    if (rest > 0) html += '<span class="up-stack-more">+' + rest + '</span>';
    return '<span class="up-stack">' + html + '</span>';
  }

  /* Loading skeleton rows for a grid table.
     spec: { count, cols:[width|{w, jitter, logo, logoStyle, cls}], rowClass, cellClass, headHtml }
     A number is a bar width in px. `cls` is appended to the cell — the tables need it because
     their column show/hide toggles target per-column classes, and the skeleton has to hide the
     same columns as the real rows. `logo` prepends the square placeholder, `logoStyle` lets the
     brand-stack column make it round instead. */
  function skeletonRows(spec){
    spec = spec || {};
    var count = spec.count || 7;
    var cols = spec.cols || [];
    var rowClass = spec.rowClass || "up-row";
    var cellClass = spec.cellClass || "up-td";
    var out = "";
    for (var i = 0; i < count; i++){
      var cells = "";
      for (var c = 0; c < cols.length; c++){
        var col = cols[c];
        var isObj = col && typeof col === "object";
        var w = (typeof col === "number") ? col : (isObj && col.w) || 0;
        /* jitter the width per row so the block doesn't read as a rigid grid */
        if (isObj && col.jitter) w = w + (i % 3) * col.jitter;
        var logo = isObj && col.logo
          ? '<span class="up-tsk-logo"' + (col.logoStyle ? ' style="' + col.logoStyle + '"' : "") + '></span>'
          : "";
        var bar = w ? '<span class="up-tsk-bar" style="width:' + w + 'px"></span>' : "";
        cells += '<div class="' + cellClass + (isObj && col.cls ? " " + col.cls : "") + '">' + logo + bar + '</div>';
      }
      out += '<div class="' + rowClass + ' up-tsk">' + cells + '</div>';
    }
    return (spec.headHtml || "") + out;
  }

  /* Empty-state grace timer.
     An empty delivery is often an interim "clearing" step a beat before the real data lands;
     committing to "No data" immediately flashes a placeholder that is gone again a moment later.
     This shows the skeleton first and only commits after the window if the state still says
     empty. 3000ms matches the line chart's own no-data window, so a table and the chart beside
     it never disagree about whether there is data.
     cfg: { showSkeleton(), commitEmpty(), stillEmpty(), ms } */
  function makeEmptyGrace(cfg){
    var t = null;
    function clear(){ if (t){ clearTimeout(t); t = null; } }
    return {
      /* call when a render finds no rows; returns true if it handled the render (grace running) */
      hold: function(){
        if (t) return true;
        cfg.showSkeleton();
        t = setTimeout(function(){
          t = null;
          if (cfg.stillEmpty && !cfg.stillEmpty()) return;   // data arrived meanwhile
          cfg.commitEmpty();
        }, cfg.ms || 3000);
        return true;
      },
      clear: clear
    };
  }

  /* Column explainer popover (the "i" next to a metric header).
     Body-appended so it can't be clipped by the table's overflow, flips above the trigger when
     there isn't room below, and clamps its caret to stay under the icon after that clamp.
     cfg: { root, triggerSel, html(key), getIsDark } */
  function makeExplain(cfg){
    var root = cfg.root;
    var el = document.createElement("div");
    el.className = "up-explain";
    document.body.appendChild(el);
    var openFor = null;
    function hide(){ el.classList.remove("is-on"); openFor = null; }
    function show(trigger){
      var key = trigger.getAttribute("data-explain");
      var html = cfg.html ? cfg.html(key) : "";
      if (!html) return;
      el.innerHTML = html;
      el.setAttribute("data-theme", (cfg.getIsDark && cfg.getIsDark()) ? "dark" : "light");
      el.classList.add("is-on");
      el.classList.remove("is-flipped");
      el.style.left = "0px"; el.style.top = "0px";
      var r = trigger.getBoundingClientRect();
      var box = el.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var left = r.left + r.width / 2 - box.width / 2;
      left = Math.max(8, Math.min(left, vw - box.width - 8));
      var top = r.bottom + 10;
      if (top + box.height > vh - 8){          // no room below → flip above the trigger
        top = r.top - box.height - 10;
        el.classList.add("is-flipped");
      }
      el.style.left = left + "px";
      el.style.top = top + "px";
      /* the caret follows the icon, not the box, because the box was clamped to the viewport */
      el.style.setProperty("--up-caret", Math.round(r.left + r.width / 2 - left) + "px");
      openFor = trigger;
    }
    root.addEventListener("mouseover", function(e){
      var t = e.target.closest(cfg.triggerSel || "[data-explain]");
      if (t && root.contains(t) && t !== openFor) show(t);
    });
    root.addEventListener("mouseout", function(e){
      var t = e.target.closest(cfg.triggerSel || "[data-explain]");
      if (!t) return;
      if (e.relatedTarget && t.contains(e.relatedTarget)) return;
      if (t === openFor) hide();
    });
    window.addEventListener("scroll", hide, { capture: true, passive: true });
    return { show: show, hide: hide, el: el };
  }

  /* ==========================================================================================
     TABLE CHROME — columns, pagination, header sorting
     ==========================================================================================
     urls-table and domains-table carried byte-identical copies of all of this (~300 lines each).
     The two tables genuinely differ in their COLUMNS, their row markup and their filters — that
     stays in the components. The machinery around it does not differ at all: the only things that
     were ever component-specific here are the per-column minimum width, which columns drop at
     which breakpoint, and whether the Columns menu offers the row-height switch. Those are now
     config, not forked code. */

  /* ---------- makeColumns ----------
     cfg: { root, state, columns, storePrefix, instanceId, firstKey, firstMin, actionsMin,
            dense, badgeSel, cellPrefixes, onChange }
       columns    — [{key, label, w, min, dropAt}]; `w` is the responsive track, `dropAt` is
                    "narrow" | "vnarrow" (the breakpoint at which the column stops being shown)
       firstKey   — the leading column that becomes a fixed px track once dragged ("domain")
       dense      — show the Comfortable/Compact switch in the menu
       cellPrefixes — class prefixes to toggle per column, e.g. ["up","uut"]
     state is the component's own object; this mutates state.cols / state.widths / state.dense. */
  function makeColumns(cfg){
    var root = cfg.root, state = cfg.state, COLUMNS = cfg.columns;
    var FIRST = cfg.firstKey || "domain";
    var FIRST_MIN = cfg.firstMin || 220, ACTIONS_MIN = cfg.actionsMin || 100;
    var prefixes = cfg.cellPrefixes || ["up"];
    /* Key format is deliberately "<pfx>_cols__<instanceId>", matching what the tables wrote
       before this machinery moved into core — changing it would silently throw away every user's
       saved column choices and drag widths on first load. */
    function colsKey(){ return cfg.storePrefix + "_cols__" + cfg.instanceId; }
    function widthsKey(){ return cfg.storePrefix + "_widths__" + cfg.instanceId; }

    function readCols(){
      var out = {};
      COLUMNS.forEach(function(c){ out[c.key] = true; });
      try {
        var raw = window.localStorage.getItem(colsKey());
        if (raw){
          var parsed = JSON.parse(raw);
          COLUMNS.forEach(function(c){ if (parsed[c.key] === false) out[c.key] = false; });
        }
      } catch(e){}
      return out;
    }
    function writeCols(){ try { window.localStorage.setItem(colsKey(), JSON.stringify(state.cols)); } catch(e){} }
    function readWidths(){
      try { var raw = window.localStorage.getItem(widthsKey()); return raw ? JSON.parse(raw) : {}; }
      catch(e){ return {}; }
    }
    function writeWidths(){ try { window.localStorage.setItem(widthsKey(), JSON.stringify(state.widths)); } catch(e){} }

    function visibleCols(){ return COLUMNS.filter(function(c){ return state.cols[c.key] !== false; }); }
    /* Drop order when the table is too narrow for every column: lowest `prio` goes first.
       Columns without an explicit prio fall back to their declaration order (leftmost = most
       important), which is the convention every table here already follows. */
    function prioOf(c){ return c.prio != null ? c.prio : (COLUMNS.length - COLUMNS.indexOf(c)); }
    /* The width the lead column will actually occupy. It is NOT simply FIRST_MIN: until the user
       drags it, its track is `minmax(30%, 1.6fr)`, so on a wide container the 30% is what really
       applies and it is far larger than FIRST_MIN. Budgeting against FIRST_MIN alone was the bug
       that let 8 columns claim ~1150px of minimums inside a 1100px table and silently overflow. */
    function firstWidth(cw){
      var pinnedW = (state.widths || {})[FIRST];
      if (pinnedW) return Math.max(FIRST_MIN, pinnedW);
      return Math.max(FIRST_MIN, cw * 0.30);
    }
    /* Measurement-driven column dropping. The hardcoded is-narrow/is-vnarrow breakpoints below
       only ever knew the ROOT's width, never what the columns actually need — so any table whose
       minimums outgrew its first breakpoint (prompts-table: ~1150px of minimums, first drop at
       860px) overflowed its own box across that whole range, pushing the rightmost columns off
       screen. This drops the least important columns until the remaining minimums genuinely fit,
       so the tiers act as a floor for intent ("never show Last Seen on mobile") while the fit
       itself is computed, not guessed. Adding a column to any table can no longer silently break
       a width range. */
    function autoFit(cols, cw){
      if (!cw) return cols;
      /* Reserve beyond the declared minimums: one separator border per column plus the table
         frame and sub-pixel track rounding. Measured, not guessed — without it an 8-column
         prompts-table still overflowed by ~20px at 1300px, because the sum of `min` values is
         not the whole story once borders and the box's own frame are laid out. Erring
         conservative here costs at most one column near a threshold; erring the other way puts
         columns off-screen, which is the bug this exists to prevent. */
      var reserve = 24 + cols.length;
      var budget = cw - firstWidth(cw) - reserve;
      if (!cfg.noActions && !root.classList.contains("is-t2")) budget -= ACTIONS_MIN;
      var need = 0;
      cols.forEach(function(c){ need += colMin(c.key); });
      if (need <= budget) return cols;
      var byPrio = cols.slice().sort(function(a, b){ return prioOf(a) - prioOf(b); });
      var dropped = {}, kept = cols.length;
      for (var i = 0; i < byPrio.length && need > budget && kept > 1; i++){
        dropped[byPrio[i].key] = true;
        need -= colMin(byPrio[i].key);
        kept--;
      }
      return cols.filter(function(c){ return !dropped[c.key]; });
    }
    /* what is actually on screen right now: user-hidden columns minus the ones this width drops */
    function effectiveCols(){
      var narrow = root.classList.contains("is-narrow");
      var vnarrow = root.classList.contains("is-vnarrow");
      var cols = visibleCols().filter(function(c){
        /* cfg.isHidden — a column the current VIEW removes entirely (not the user, not the
           width). Kept separate from state.cols on purpose: writing the user's saved column
           prefs to hide it would silently clobber their choice when the view switches back. */
        if (cfg.isHidden && cfg.isHidden(c)) return false;
        if (vnarrow && c.dropAt === "vnarrow") return false;
        if ((narrow || vnarrow) && c.dropAt === "narrow") return false;
        return true;
      });
      return autoFit(cols, root.getBoundingClientRect().width || 0);
    }
    /* cfg.noActions: tables without a row-actions column (e.g. prompts-table) skip the fixed
       trailing track entirely instead of reserving space for a column that has no cells. */
    function layoutKeys(){
      return [FIRST].concat(effectiveCols().map(function(c){ return c.key; }))
             .concat((cfg.noActions || root.classList.contains("is-t2")) ? [] : ["actions"]);
    }
    function colMin(key){
      if (key === FIRST) return FIRST_MIN;
      if (key === "actions") return ACTIONS_MIN;
      var c = COLUMNS.filter(function(x){ return x.key === key; })[0];
      return (c && c.min) || 100;
    }
    /* see applyCols(): the two halves are guarded separately because they change at different
       rates — the track template on every width change, the visible column set only when a
       column actually drops in or out. */
    var lastTpl = null, lastSigCols = null;
    function applyCols(){
      /* The grid template is rebuilt from the shown columns rather than just hiding cells: with
         CSS grid a hidden cell would leave its track behind and knock the whole row out of line.
         effectiveCols() and the container width are read ONCE up front and reused: every call
         measures layout, and interleaving those reads with the style writes below is a textbook
         read-write-read thrash — the thing that makes a resize drag feel like it is running at a
         fraction of the frame rate. */
      var cw = root.getBoundingClientRect().width || 0;
      var cols = effectiveCols();
      var shown = {};
      cols.forEach(function(c){ shown[c.key] = true; });
      /* Bail out before touching the DOM when nothing about the layout actually changed. This is
         now the hot path: applyCols() runs on EVERY resize frame (it has to — column dropping is
         width-driven, not breakpoint-driven), and a 25-row table means ~200 style writes per
         frame. Most frames of a drag change no columns at all, so the signature check turns those
         into one rect read plus one querySelector. The per-row marker attribute is what makes it
         safe: a fresh renderTable() creates rows without it, so re-rendered rows always get the
         template written even when the signature itself is unchanged. */
      var sigCols = cols.map(function(c){ return c.key; }).join(",");
      var W = state.widths || {};
      var pinned = !!W[FIRST];
      var firstPx = W[FIRST];
      if (pinned){
        /* Once the lead column is pinned to a pixel width, every other track has to switch from
           its percentage minimum to its PIXEL minimum: the percentages are relative to the whole
           grid, not to the space left over, so keeping them made the tracks add up to more than
           the container and the table overflowed. Clamping against the available width stops a
           pinned lead column plus the other minimums from pushing Actions outside the box. */
        var othersMin = 0;
        cols.forEach(function(c){ othersMin += colMin(c.key); });
        if (!cfg.noActions && !root.classList.contains("is-t2")) othersMin += ACTIONS_MIN;
        if (cw) firstPx = Math.max(FIRST_MIN, Math.min(W[FIRST], cw - othersMin));
      }
      var parts = [pinned ? firstPx + "px" : "minmax(30%, 1.6fr)"];
      cols.forEach(function(c){
        parts.push(pinned ? "minmax(" + colMin(c.key) + "px, 1fr)" : c.w);
      });
      if (!cfg.noActions && !root.classList.contains("is-t2")){
        parts.push(pinned ? ACTIONS_MIN + "px" : "minmax(" + ACTIONS_MIN + "px, auto)");
      }
      var tpl = parts.join(" ");
      /* The track list goes on the ROOT as --up-cols; core.css has .up-thead/.up-row read it via
         var(). One style write instead of one per row — during a column drag that is the
         difference between ~100 writes per frame and 1, and it costs nothing to keep in sync
         because freshly rendered rows inherit it automatically. */
      if (tpl !== lastTpl){
        root.style.setProperty("--up-cols", tpl);
        lastTpl = tpl;
      }
      /* Per-cell show/hide has to touch cells, so it gets its own guard — but the guard CANNOT be
         "the column set is unchanged" alone. Hiding a cell is an inline style, and renderTable()
         replaces every .up-row with brand-new nodes that carry no inline styles at all. So after
         any re-render (sort, search, page, new data) the fresh rows show every cell again while
         --up-cols still lists only the visible tracks — the surplus cells then wrap onto a second
         implicit grid row, which is the "two rows rendered inside one row" breakage.
         Hence the stamp: rows carry the column signature they were styled for, and a row without
         the current one is by definition un-styled and needs the write. */
      var firstRow = root.querySelector(".up-row");
      var rowsStale = !!firstRow && firstRow.getAttribute("data-up-colsig") !== sigCols;
      if (sigCols === lastSigCols && !rowsStale) return;
      lastSigCols = sigCols;
      COLUMNS.forEach(function(c){
        var sel = [];
        for (var p = 0; p < prefixes.length; p++){
          sel.push("." + prefixes[p] + "-th-" + c.key, "." + prefixes[p] + "-td-" + c.key);
        }
        Array.prototype.forEach.call(root.querySelectorAll(sel.join(", ")), function(el){
          el.style.display = shown[c.key] ? "" : "none";
        });
      });
      Array.prototype.forEach.call(root.querySelectorAll(".up-row"), function(r){
        r.setAttribute("data-up-colsig", sigCols);
      });
    }
    /* drag the lead column's right edge; everything else keeps its responsive track */
    function startResize(e){
      var thead = root.querySelector(".up-thead");
      if (!thead) return;
      var startX = e.clientX;
      var first = thead.firstElementChild;
      var wA = first.getBoundingClientRect().width;
      var total = thead.getBoundingClientRect().width;
      var others = layoutKeys().slice(1).reduce(function(sum, k){ return sum + colMin(k); }, 0);
      /* Has to subtract the same `reserve` fudge autoFit's own budget does (see autoFit above) —
         without it this let the drag go `reserve` px further than autoFit actually tolerates, so
         dragging the lead column anywhere near this max caused autoFit to drop the lowest-prio
         column mid-drag even though every other column was still sitting right at its own
         minimum. Two independently-computed "how far can the lead column grow" limits that
         disagreed by exactly one fudge factor. */
      var reserve = 24 + effectiveCols().length;
      var maxA = Math.max(FIRST_MIN, total - others - reserve);
      var grip = e.target.closest(".up-grip");
      if (grip) grip.classList.add("is-active");
      root.classList.add("is-resizing");
      /* pointermove fires up to 120 Hz on a trackpad — several times per frame — and each event
         used to run a full applyCols(). Coalesce to one apply per animation frame: the extra
         events carried no information the last one didn't already supersede. */
      var moveRaf = null, pendingX = null;
      function commitMove(){
        if (pendingX == null) return;
        state.widths[FIRST] = Math.round(Math.max(FIRST_MIN, Math.min(maxA, wA + (pendingX - startX))));
        applyCols();
      }
      function move(ev){
        pendingX = ev.clientX;
        if (moveRaf) return;
        moveRaf = requestAnimationFrame(function(){ moveRaf = null; commitMove(); });
      }
      function up(){
        /* Flush the last pointer position synchronously rather than dropping it — cancelling a
           pending frame without committing would leave the column a few px off wherever the user
           actually released. */
        if (moveRaf){ cancelAnimationFrame(moveRaf); moveRaf = null; commitMove(); }
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        root.classList.remove("is-resizing");
        if (grip) grip.classList.remove("is-active");
        writeWidths();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      e.preventDefault();
    }
    var COMFY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>';
    var COMPACT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
    function populateCols(){
      var menu = root.querySelector(".up-cols-menu");
      if (!menu) return;   // a stale/incomplete root copy may be missing this markup
      var listed = COLUMNS.filter(function(c){ return !(cfg.isHidden && cfg.isHidden(c)); });
      var vis = visibleCols().filter(function(c){ return !(cfg.isHidden && cfg.isHidden(c)); });
      var off = listed.length - vis.length;
      var head = '<div class="up-pop-head up-pop-head-row">' +
        '<span>Columns</span>' +
        '<button class="up-pop-action' + (off >= 2 ? "" : " is-hidden") + '" type="button" data-colsall>Select all</button>' +
      '</div>';
      var rows = listed.map(function(c){
        var on = state.cols[c.key] !== false;
        var locked = on && vis.length === 1;   // the last visible column can't be turned off
        return '<div class="up-pop-row' + (locked ? " is-locked" : "") + '" data-col="' + c.key + '">' +
                 '<span class="up-pop-label">' + esc(c.label) + '</span>' +
                 '<span class="up-switch' + (on ? " is-on" : "") + '" role="switch"></span>' +
               '</div>';
      }).join("");
      var densePart = cfg.dense
        ? '<div class="up-pop-div"></div>' +
          '<div class="up-pop-sub">Row height</div>' +
          '<div class="up-dense">' +
            '<button class="up-dense-btn' + (!state.dense ? " is-active" : "") + '" type="button" data-dense="0">' + COMFY_SVG + 'Comfortable</button>' +
            '<button class="up-dense-btn' + (state.dense ? " is-active" : "") + '" type="button" data-dense="1">' + COMPACT_SVG + 'Compact</button>' +
          '</div>'
        : "";
      /* cfg.rowHeightSwitch: [{key,label,icon}, ...] — a 3(+)-way row-height picker instead of
         the 2-way Comfortable/Compact above, for tables with a genuine third (e.g. dynamic)
         height mode. Wired against state.rowHeight (a string), not state.dense (a bool). Click
         handling stays local to the component, same as data-dense today. */
      var rowHeightPart = cfg.rowHeightSwitch
        ? '<div class="up-pop-div"></div>' +
          '<div class="up-pop-sub">Row height</div>' +
          '<div class="up-dense up-dense-3">' +
            cfg.rowHeightSwitch.map(function(o){
              return '<button class="up-dense-btn up-dense-btn-icon' + (state.rowHeight === o.key ? " is-active" : "") +
                     '" type="button" data-rowheight="' + o.key + '" data-tip="' + esc(o.label) + '">' + o.icon + '</button>';
            }).join("") +
          '</div>'
        : "";
      menu.innerHTML = head + rows + densePart + rowHeightPart;
    }
    function syncColsBadge(){
      var badge = cfg.badgeSel ? root.querySelector(cfg.badgeSel) : null;
      if (!badge) return;
      var all = COLUMNS.length, active = visibleCols().length;
      var show = all > 0 && active > 0 && active < all;
      badge.textContent = show ? String(active) : "";
      badge.classList.toggle("is-visible", show);
    }
    function refresh(){ writeCols(); populateCols(); applyCols(); syncColsBadge(); }
    function toggleCol(key){
      var on = state.cols[key] !== false;
      if (on && visibleCols().length === 1) return;   // never hide the last one
      state.cols[key] = !on;
      refresh();
      if (cfg.onChange) cfg.onChange();
    }
    function selectAllCols(){
      COLUMNS.forEach(function(c){ state.cols[c.key] = true; });
      refresh();
      if (cfg.onChange) cfg.onChange();
    }
    return {
      readCols: readCols, writeCols: writeCols, readWidths: readWidths, writeWidths: writeWidths,
      visibleCols: visibleCols, effectiveCols: effectiveCols, layoutKeys: layoutKeys, colMin: colMin,
      applyCols: applyCols, startResize: startResize, populateCols: populateCols,
      toggleCol: toggleCol, selectAllCols: selectAllCols, syncColsBadge: syncColsBadge
    };
  }

  /* ---------- makePager ----------
     cfg: { root, state, onChange } — onChange(reason) fires after page/size changes so the
     component can persist, re-render and tell Bubble. */
  function makePager(cfg){
    var root = cfg.root, state = cfg.state;
    var elFoot = root.querySelector(".up-foot");
    /* .up-foot is space-between by default (page size left, page nav right via margin-left:auto)
       — fine on one line, but once there's no room and it wraps to two lines that layout leaves
       each row hugging its own edge instead of reading as one centred block. Detected by
       comparing the two groups' own top offsets (same top -> one line, different top -> wrapped)
       rather than a fixed width breakpoint, because what wraps depends on how many page-number
       buttons are actually showing, not just the container's width. Shared here so it applies to
       every table that uses this pager, not just whichever one asked for it first. */
    function syncFootWrap(){
      if (!elFoot) return;
      var pagesize = elFoot.querySelector(".up-pagesize");
      var pager = elFoot.querySelector(".up-pager");
      if (!pagesize || !pager) return;
      var wrapped = Math.round(pagesize.getBoundingClientRect().top) !== Math.round(pager.getBoundingClientRect().top);
      elFoot.classList.toggle("is-wrapped", wrapped);
    }
    if (elFoot && window.ResizeObserver){
      var footRaf = null;
      new ResizeObserver(function(){
        if (footRaf) return;
        footRaf = requestAnimationFrame(function(){ footRaf = null; syncFootWrap(); });
      }).observe(elFoot);
    }
    function pageCount(){
      var t = toNum(state.totalCount);
      if (t == null || t <= 0) return 1;
      return Math.max(1, Math.ceil(t / state.pageSize));
    }
    function offset(){ return (state.page - 1) * state.pageSize; }
    /* 1 … 4 5 6 … 12 — always the ends, a window around the current page, gaps elsewhere */
    function pageWindow(cur, total){
      if (total <= 7){
        var all = [];
        for (var i = 1; i <= total; i++) all.push(i);
        return all;
      }
      var out = [1];
      var from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
      if (from > 2) out.push("gap");
      for (var p = from; p <= to; p++) out.push(p);
      if (to < total - 1) out.push("gap");
      out.push(total);
      return out;
    }
    function renderPager(){
      var el = root.querySelector(".up-pager");
      if (!el) return;
      var total = pageCount();
      var cur = Math.min(state.page, total);
      if (cur !== state.page){ state.page = cur; if (cfg.onClamp) cfg.onClamp(); }
      var t = toNum(state.totalCount);
      var info = "";
      if (t != null && t > 0){
        var from = offset() + 1;
        var to = Math.min(offset() + state.pageSize, t);
        info = '<span class="up-pager-info">' + fmtInt(from) + '–' + fmtInt(to) + ' of ' + fmtTotal(t) + '</span>';
      }
      var pages = pageWindow(cur, total).map(function(p){
        if (p === "gap") return '<span class="up-page-gap">…</span>';
        return '<button class="up-page' + (p === cur ? " is-active" : "") + '" type="button" data-page="' + p + '">' + p + '</button>';
      }).join("");
      el.innerHTML = info +
        '<button class="up-page up-page-prev" type="button" aria-label="Previous page"' + (cur <= 1 ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
        pages +
        '<button class="up-page up-page-next" type="button" aria-label="Next page"' + (cur >= total ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
      syncFootWrap();   // page count just changed -> the row may have gained/lost a line
    }
    function renderPageSize(){
      /* .up-pagesize-seg, NOT .up-pagesize: the outer element also holds the "Rows per page"
         label, and the grey switcher background lives on the -seg wrapper. Writing into the outer
         one wiped both. */
      var el = root.querySelector(".up-pagesize-seg");
      if (!el) return;
      el.innerHTML = PAGE_SIZES.map(function(n){
        return '<button class="up-pagesize-btn' + (n === state.pageSize ? " is-active" : "") +
               '" type="button" data-pagesize="' + n + '">' + n + '</button>';
      }).join("");
      syncFootWrap();
    }
    function goToPage(p){
      var total = pageCount();
      p = Math.max(1, Math.min(total, p));
      if (p === state.page) return;
      state.page = p;
      state.loading = true;   // show a skeleton until the new page's rows arrive
      renderPageSize(); renderPager();
      if (cfg.onChange) cfg.onChange("page");
    }
    function setPageSize(n){
      if (n === state.pageSize) return;
      state.pageSize = n;
      state.page = 1;          // a different window size invalidates the current page index
      state.loading = true;    // show a skeleton until the resized page arrives
      renderPageSize(); renderPager();
      if (cfg.onChange) cfg.onChange("size");
    }
    return { pageCount: pageCount, offset: offset, pageWindow: pageWindow,
             renderPager: renderPager, renderPageSize: renderPageSize,
             goToPage: goToPage, setPageSize: setPageSize };
  }

  /* ---------- makeSoftReload ----------
     Sort re-orders the SAME result set — the rows on screen are still truthful, so a sort dims
     them in place instead of blanking to a skeleton (which reads as "the table broke" on every
     header click). Started here first for prompts-table, now shared once urls-table and
     domains-table needed the identical thing for their own sort.
     Deliberately driven by explicit begin()/end() calls at the exact user-action moment rather
     than derived from a loading flag: the derivation was the original bug — whether a loading
     flag is ever set depends on how the Bubble workflow is wired, and any render() call arriving
     in between resets whatever the derivation depended on, so the dim silently never appeared.
     cfg: { delay (ms before it shows, default 0), killAfter (hard timeout, default 20000) } */
  function makeSoftReload(root, cfg){
    cfg = cfg || {};
    var delay = cfg.delay != null ? cfg.delay : 0;
    var killAfter = cfg.killAfter != null ? cfg.killAfter : 20000;
    var dimTimer = null, dimKill = null;
    function begin(hasContent){
      clearTimeout(dimTimer); clearTimeout(dimKill);
      if (!hasContent) return;   // nothing on screen to dim
      if (delay <= 0) root.classList.add("is-reloading");
      else dimTimer = setTimeout(function(){ dimTimer = null; root.classList.add("is-reloading"); }, delay);
      /* Never let it stick: if the answer never arrives, a permanently greyed-out table is worse
         than no feedback at all. */
      dimKill = setTimeout(end, killAfter);
    }
    function end(){
      clearTimeout(dimTimer); clearTimeout(dimKill);
      dimTimer = dimKill = null;
      root.classList.remove("is-reloading");
    }
    return { begin: begin, end: end };
  }

  /* ---------- makeHeadSort ----------
     Clicking a column header walks that column's cycle (e.g. share:desc -> share:asc ->
     share_trend:desc …) and falls back to the table's default once the cycle is exhausted.
     cfg: { root, state, cycles, defaultSort, trendField, onSort } */
  function makeHeadSort(cfg){
    var root = cfg.root, state = cfg.state;
    var TREND = cfg.trendField || null;   // a second sort key that shares the Share column
    function syncHeadSorters(){
      Array.prototype.forEach.call(root.querySelectorAll(".up-thsort"), function(el){
        var col = el.getAttribute("data-for");
        el.classList.remove("is-asc","is-desc");
        /* the Share header lights up for its trend key too — they share one column */
        var owns = (TREND && col === "share")
          ? (state.sortField === "share" || state.sortField === TREND)
          : (state.sortField === col);
        if (owns) el.classList.add(state.sortDir === "asc" ? "is-asc" : "is-desc");
        var th = el.closest(".up-th");
        if (th) th.setAttribute("aria-sort", owns ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
      });
      if (!TREND) return;
      /* show "Trend" next to the Share label while the trend key is the active sort */
      var shareTh = root.querySelector(".up-th-share");
      if (!shareTh) return;
      var sub = shareTh.querySelector(".up-th-sub");
      if (state.sortField === TREND){
        if (!sub){
          sub = document.createElement("span");
          sub.className = "up-th-sub";
          sub.textContent = "Trend";
          shareTh.insertBefore(sub, shareTh.querySelector(".up-thsort"));
        }
      } else if (sub && sub.parentNode){ sub.parentNode.removeChild(sub); }
    }
    function headSortClick(col){
      var cycle = cfg.cycles[col];
      if (!cycle) return;
      var idx = cycle.indexOf(state.sortField + ":" + state.sortDir);   // -1 = another column owns the sort
      var pos = idx + 1;                                                // -1 -> 0: start this cycle at the top
      if (pos >= cycle.length){                                         // past the end -> back to the default
        cfg.onSort(cfg.defaultSort.field, cfg.defaultSort.dir);
        return;
      }
      var parts = cycle[pos].split(":");
      cfg.onSort(parts[0], parts[1]);
    }
    return { syncHeadSorters: syncHeadSorters, headSortClick: headSortClick };
  }

  /* Clipboard fallback for browsers/iframes where navigator.clipboard is unavailable. */
  function legacyCopy(text){
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch(e){ return false; }
  }

  /* ---------- makeSearch ----------
     The slide-out search in the toolbar. urls-table and domains-table carried copies that were
     identical apart from comments, so there is nothing component-specific left here except the
     wiring: which elements, what to re-render, and what to send.

     cfg: { root, box, input, state, minChars, debounceMs, mobileMax, prefix,
            onRender(), onFire(payload), onTakeoverEnd(), persist() }
     Returns { toggle, run, onInput, syncTakeover, latestReqId(), setLatest(id) }.
     latestReqId is exposed because the component's update() drops responses whose requestId is
     not the newest one — that guard is what stops a slow early query from overwriting a fast
     later one. */
  function makeSearch(cfg){
    var root = cfg.root, box = cfg.box, input = cfg.input, state = cfg.state;
    var MINC = cfg.minChars != null ? cfg.minChars : MIN;
    var DEB = cfg.debounceMs != null ? cfg.debounceMs : DEBOUNCE;
    var MOBILE_MAX = cfg.mobileMax || 640;
    var debTimer = null, latestReqId = null;

    function newReqId(){ return cfg.prefix + "_" + (+new Date()) + "_" + Math.random().toString(36).slice(2,8); }
    function run(){
      var reqId = newReqId(); latestReqId = reqId;
      state.page = 1;                 // a new query is a new result set
      state.loading = true;
      if (cfg.onRender) cfg.onRender();
      cfg.onFire({
        query: state.query,
        query_folded: foldDiacritics(state.query),
        query_de: germanExpand(state.query),
        requestId: reqId
      });
    }
    function onInput(){
      state.query = String(input.value || "").trim();
      box.classList.toggle("has-text", !!input.value.length);
      if (cfg.persist) cfg.persist();
      clearTimeout(debTimer);
      /* Below the minimum an EMPTY query still has to go out — that is how the table gets its
         unfiltered list back once the user clears the box. */
      if (state.query.length && state.query.length < MINC){ latestReqId = null; return; }
      debTimer = setTimeout(run, DEB);
    }
    function toggle(){
      var open = !box.classList.contains("is-open");
      box.classList.toggle("is-open", open);
      syncTakeover();   // mobile: take over the row when opening, release it when closing
      /* Deliberately no toolbar re-fit here: the open search's width is already reserved by the
         component's own gap calculation, so the tier decision is the same open or closed.
         Re-measuring mid-transition would read too much room and wrongly un-hide toolbar items. */
      if (open){ setTimeout(function(){ try { input.focus(); } catch(e){} }, 60); }
      else if (state.query){
        state.query = ""; input.value = "";       // closing clears the search
        box.classList.remove("has-text");
        if (cfg.persist) cfg.persist();
        clearTimeout(debTimer);
        run();
      }
    }
    /* On a narrow component an open search takes over the whole toolbar row. */
    function syncTakeover(){
      var w = root.getBoundingClientRect().width || 0;
      var on = !!box && box.classList.contains("is-open") && w > 0 && w < MOBILE_MAX;
      if (on === root.classList.contains("is-searchtakeover")) return;
      root.classList.toggle("is-searchtakeover", on);
      if (!on && cfg.onTakeoverEnd) cfg.onTakeoverEnd();
    }
    return {
      toggle: toggle, run: run, onInput: onInput, syncTakeover: syncTakeover,
      latestReqId: function(){ return latestReqId; },
      setLatest: function(id){ latestReqId = id; },
      cancel: function(){ clearTimeout(debTimer); }
    };
  }

  /* ==========================================================================================
     MOUNT — the Bubble plumbing every component needs
     ==========================================================================================
     Each component carried ~200 lines of this: the boot retry, the stub queue, the root registry,
     the iframe forwarder, the wheel forwarding and the init cascade. None of it is about what the
     component DOES; all of it is about surviving how Bubble injects and re-renders markup.

     Deliberately NOT included: doRender / doLoading / initRoot. Those genuinely differ — some
     components broadcast an update to every root sharing an instanceId, topcitations resolves the
     single visible one. That is a real decision per component, not drift, so it stays local.

     Usage is two calls. Before anything else, while core.js may still be loading:
       UC.bootStubs({ names: ["renderFoo","setFooLoading","resetFoo"], flag: "__fooBootStubbed",
                      queue: "__fooBootQueue" });
     then, once the component's own run() executes:
       var mount = UC.makeMount({ rootClass:"foo-root", ctrlProp:"__fooController",
                                  resolveLocal:"__fooResolveLocal", initRoot:initRoot,
                                  api:{ renderFoo:doRender, setFooLoading:doLoading },
                                  queue:"__fooBootQueue" }); */
  function bootStubs(cfg){
    var q = window[cfg.queue] = window[cfg.queue] || [];
    if (window[cfg.flag]) return q;
    window[cfg.flag] = true;
    /* Bubble's "Run Javascript" steps poll for these by name and call whichever is callable
       first. Without stubs a "data has arrived" call could beat a "start loading" call issued
       earlier, because each poll wins independently. Queuing here keeps Bubble's original order. */
    cfg.names.forEach(function(n){
      window[n] = function(){ q.push([n, arguments]); };
    });
    return q;
  }

  function makeMount(cfg){
    var rootSel = "." + cfg.rootClass + (cfg.notPortal ? ":not(.up-portal)" : "");

    function roots(){ return document.querySelectorAll(rootSel); }
    function rootsWithId(id){
      id = id || "default";
      var out = [], all = roots();
      for (var i = 0; i < all.length; i++){
        if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
      }
      return out;
    }
    function initAll(){ var all = roots(); for (var i = 0; i < all.length; i++) cfg.initRoot(all[i]); }

    /* Expose the real implementations, then replay whatever Bubble queued against the stubs —
       in the order Bubble called them. */
    Object.keys(cfg.api).forEach(function(name){ window[name] = cfg.api[name]; });
    window[cfg.resolveLocal] = function(id){ return rootsWithId(id).length > 0; };
    var q = window[cfg.queue];
    if (q && q.length){
      q.splice(0, q.length).forEach(function(entry){
        try { window[entry[0]].apply(null, entry[1]); } catch(e){}
      });
    }

    /* ---- forwarder on parent AND top ----
       A component often lives inside a Bubble reusable, i.e. its own iframe, while the workflow
       calling render* runs in the parent page. Walk every reachable frame and hand the call to
       whichever one actually owns that instanceId; fall back to any frame that has the function
       so a mismatched id still lands somewhere rather than silently doing nothing. */
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
          var delivered = false;
          for (var a = 0; a < seen.length; a++){
            try {
              var c = seen[a];
              if (c && typeof c[fnName] === "function" && c[cfg.resolveLocal] && c[cfg.resolveLocal](id)){
                c[fnName](arg1, arg2); delivered = true;
              }
            } catch(e){}
          }
          if (delivered) return true;
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
            Object.keys(cfg.api).forEach(function(name){
              var shape = cfg.forwardShape && cfg.forwardShape[name];
              if (shape === "params"){
                w[name] = function(params){ params = params || {}; return deliver(name, params.instanceId || "default", params); };
              } else if (shape === "id"){
                w[name] = function(id){ return deliver(name, id || "default", id); };
              } else {
                w[name] = function(id, v){ return deliver(name, id || "default", id, v); };
              }
            });
          } catch(e){}
        })(targets[t]);
      }
    })();

    /* ---- wheel forwarding ----
       Chart.js sets touch-action:none on its canvas and other regions swallow the wheel too, so
       the event never reaches the app's scroll container. Forward it to the nearest scrollable
       ancestor of the ACTUAL target — that way an internal scrollable (a long dropdown list)
       scrolls itself instead of having its wheel hijacked up to the page. */
    function scrollTarget(fromEl){
      var node = fromEl;
      while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement){
        try {
          var oy = getComputedStyle(node).overflowY;
          if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) return node;
        } catch(e){}
        node = node.parentNode;
      }
      var byId = document.getElementById("main");
      if (byId && byId.scrollHeight > byId.clientHeight + 2) return byId;
      var se = document.scrollingElement || document.documentElement;
      if (se && se.scrollHeight > se.clientHeight + 2) return se;
      return byId || null;
    }
    function forwardWheel(e){
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;   // leave horizontal gestures alone
      var t = scrollTarget(e.target);
      if (t){ if (e.cancelable) e.preventDefault(); t.scrollTop += e.deltaY; return; }
      try { if (window.parent && window.parent !== window) window.parent.scrollBy(0, e.deltaY); } catch(ex){}
      try { window.scrollBy(0, e.deltaY); } catch(ex){}
    }
    /* cfg.wheelSel — WHICH elements inside the root actually need this. Omit it and nothing is
       intercepted at all, which is what every table wants.
       This used to be bound to the whole component root, which was far too wide a net. The problem
       it solves is real but narrow: Chart.js registers its own wheel handling on the canvas, so a
       wheel over a chart never reached Bubble's scroll container and the page simply refused to
       scroll there. Everywhere else there was nothing to fix — and replacing native scrolling with
       `scrollTop += deltaY` throws away compositor-thread scrolling, inertia and rubber-banding,
       which on a trackpad is exactly the "doesn't feel like a real app" difference. Tables are the
       biggest surfaces in this library, so they were paying that cost on every scroll for a
       problem they never had. */
    var wheelFlag = "__upWheel_" + cfg.rootClass;
    function wheelTargets(){
      if (!cfg.wheelSel) return [];
      var out = [], all = roots();
      for (var i = 0; i < all.length; i++){
        var found = all[i].querySelectorAll(cfg.wheelSel);
        for (var j = 0; j < found.length; j++) out.push(found[j]);
      }
      return out;
    }
    function attachWheel(){
      var all = wheelTargets();
      for (var i = 0; i < all.length; i++){
        if (!all[i][wheelFlag]){ all[i][wheelFlag] = true; all[i].addEventListener("wheel", forwardWheel, { passive: false }); }
      }
    }
    if (cfg.wheelSel && !window[wheelFlag + "_installed"]){
      window[wheelFlag + "_installed"] = true;
      attachWheel();
      /* Chart wraps are re-created on every render, so newly built ones still need picking up.
         Only runs for components that actually declared a wheelSel. */
      setInterval(attachWheel, 800);
    }

    /* ---- init cascade ----
       Bubble can insert the markup well after this script runs, and again on every re-render.
       watchRoots covers the long tail; the short cascade catches the common early cases, and the
       pointerdown fallback rescues a root that somehow escaped both the moment it is touched. */
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
    else initAll();
    [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
    document.addEventListener("pointerdown", function(e){
      var r = e.target && e.target.closest ? e.target.closest(rootSel) : null;
      if (r && !r[cfg.ctrlProp]) cfg.initRoot(r);
    }, true);
    if (watchRoots) watchRoots(cfg.rootClass, initAll);

    return { roots: roots, rootsWithId: rootsWithId, initAll: initAll };
  }

  /* Survives Bubble rebuilding the element, keyed by instanceId. */
  var STORE = (window.__uutStore = window.__uutStore || {});
  var LOADING_EXPLICIT = (window.__uutLoadingExplicit = window.__uutLoadingExplicit || {});

  /* Shared button/brand tooltip — the ONE implementation for the whole library.
     Before this, four near-identical copies existed (.up-tip here, plus .vot-tip, .tcd-tip and
     .cc-tip inside three components). They drifted: the multi-instance fix landed in two of them,
     the hover delay in three, the mousemove safety net in two. This is the union of all four.

     The element AND its state live on window, not per root. That is the actual multi-instance
     fix: every root binds to the same singleton chip, so per-root state meant an idle second
     instance — whose own btn is almost always null — kept winning the mousemove/scroll safety-net
     race and hid the tooltip out from under whichever instance you were really hovering. That
     read as "tooltips barely ever show, they bug out."

     getIsDark() is only the fallback: the theme is read from the hovered button's own .up-root
     first, so two roots on one page in different themes each get the right chip.
     Signature and return shape are unchanged, so existing call sites keep working as-is. */
  function makeTooltips(root, getIsDark){
    var tip = window.__upTipEl;
    if (!tip || !document.body.contains(tip)){
      tip = document.createElement("div");
      tip.className = "up-tip";
      document.body.appendChild(tip);
      window.__upTipEl = tip;
    }
    var S = window.__upTipState || (window.__upTipState = {
      timer: null, btn: null, placedRect: null, lastScrollAt: 0, wide: false, suppressed: false
    });

    function placeTip(){
      if (!S.btn) return;
      tip.style.transform = "";
      var r = S.btn.getBoundingClientRect();
      tip.style.left = "0px"; tip.style.top = "0px";
      var tr = tip.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      /* the wide variant left-aligns to the trigger (long text, centring looks arbitrary),
         the normal chip centres under it */
      var left = S.wide ? r.left : (r.left + r.width / 2 - tr.width / 2);
      tip.style.left = Math.max(6, Math.min(left, vw - tr.width - 6)) + "px";
      tip.style.top = (r.bottom + 8) + "px";
      S.placedRect = r;
    }
    function hideTip(){
      clearTimeout(S.timer); S.timer = null; S.btn = null; S.placedRect = null;
      /* clear any leftover inline transform from the scroll nudge, otherwise it would beat the
         CSS translateY fade-out and the chip would just blink off */
      tip.style.transform = "";
      tip.classList.remove("is-on"); tip.classList.remove("is-wide");
    }
    function paint(el, text, wide){
      if (!text || !el || !document.contains(el)) return;
      /* Belt-and-suspenders for hover-reveal buttons (chart settings gears and anything else that
         fades in on its own delay): if the browser somehow still delivers a mouseover for an
         element sitting at opacity:0 — a stale CDN pin still on the old timing, or a browser that
         doesn't recompute :hover the instant a CSS transition-delay elapses under an already-
         stationary cursor — this is the one choke point every tip-showing path (showTip/
         showTipText/showTipWide) funnels through, so it's the one place that needs the check. */
      if (getComputedStyle(el).opacity === "0") return;
      var host = el.closest ? el.closest(".up-root") : null;
      var dark = host ? host.getAttribute("data-theme") === "dark" : !!(getIsDark && getIsDark());
      tip.textContent = text;
      tip.classList.toggle("is-wide", !!wide);
      S.wide = !!wide;
      tip.setAttribute("data-theme", dark ? "dark" : "light");
      tip.classList.add("is-on");
      S.btn = el;
      placeTip();
    }
    /* showTip/showTipText/showTipWide are immediate (a component asking explicitly already
       decided); only the delegated hover path below applies the 60ms delay. */
    function showTip(el){ if (!S.suppressed) paint(el, el.getAttribute("data-tip"), false); }
    function showTipText(el, t){ if (!S.suppressed) paint(el, t, false); }
    function showTipWide(el, text){ if (!S.suppressed) paint(el, text, true); }

    if (!root.__upTipBound){
      root.__upTipBound = true;
      /* S.lastScrollAt guards these: scrolling moves content under a completely stationary
         cursor and the browser recomputes hover as different elements pass under it. Without
         suppressing that, a mid-scroll phantom mouseout on the tipped button (or mouseover on
         some other [data-tip] scrolling past) fought the transform-nudge below — which is what
         read as the tooltip "jumping wildly" while scrolling instead of tracking one target. */
      root.addEventListener("mouseover", function(e){
        if (Date.now() - S.lastScrollAt < 200) return;
        var el = e.target.closest("[data-tip]");
        if (el && root.contains(el)){
          if (el === S.btn) return;                       // already showing for this button
          S.suppressed = false; S.btn = el;
          clearTimeout(S.timer);
          S.timer = setTimeout(function(){ showTip(el); }, 60);
          return;
        }
        var bt = e.target.closest("[data-brandtip]");
        if (bt && root.contains(bt)){
          if (bt === S.btn) return;
          S.suppressed = false; S.btn = bt;
          clearTimeout(S.timer);
          S.timer = setTimeout(function(){ showTipText(bt, bt.getAttribute("data-brandtip")); }, 60);
        }
      });
      root.addEventListener("mouseout", function(e){
        if (Date.now() - S.lastScrollAt < 200) return;
        var el = e.target.closest("[data-tip],[data-brandtip]");
        if (!el) return;
        if (e.relatedTarget && el.contains(e.relatedTarget)) return;   // still inside the trigger
        if (el === S.btn){ S.suppressed = false; hideTip(); }
      });
      /* A click means the user acted — keep the tip down until they leave and come back, rather
         than having it pop up again over whatever the click just opened. */
      root.addEventListener("mousedown", function(){ S.suppressed = true; hideTip(); });
      root.addEventListener("click", function(){ S.suppressed = true; hideTip(); });
    }

    /* One global safety net for the whole page — it operates on the shared state, so it does not
       matter which root's call installed it. */
    if (!window.__upTipGlobalBound){
      window.__upTipGlobalBound = true;
      /* if a button is removed or replaced mid-hover its mouseout never fires, so verify on each
         move that the anchor still exists and is still hovered */
      document.addEventListener("mousemove", function(){
        if (!tip.classList.contains("is-on") && !S.timer) return;
        if (!S.btn || !document.contains(S.btn)){ hideTip(); return; }
        var still = false;
        try { still = S.btn.matches(":hover"); } catch(err){ still = true; }
        if (!still) hideTip();
      });
      /* Keep an open tooltip glued to its trigger while the page scrolls: a cheap
         compositor-only transform nudge per frame, then one full reposition once scrolling
         settles. Just hiding on scroll reads as "the tooltip vanished", not "it is attached". */
      var repositionRaf = null, settleTimer = null;
      window.addEventListener("scroll", function(){
        S.lastScrollAt = Date.now();
        if (!S.btn) return;
        if (repositionRaf) return;
        repositionRaf = requestAnimationFrame(function(){
          repositionRaf = null;
          if (!S.btn || !S.placedRect) return;
          var r = S.btn.getBoundingClientRect();
          tip.style.transform = "translate(" + Math.round(r.left - S.placedRect.left) + "px," + Math.round(r.top - S.placedRect.top) + "px)";
          clearTimeout(settleTimer);
          settleTimer = setTimeout(function(){ if (S.btn) placeTip(); }, 150);
        });
      }, { capture: true, passive: true });
      window.addEventListener("blur", hideTip);
    }
    /* Lifts the post-click suppression above. A component that drives its own hover-tooltip (the
       "show the full title only when it is actually clipped" pattern in the tables) has to call
       this from its own mouseover handler, because the delegated [data-tip] path — the only place
       that clears `suppressed` — never runs for those elements: they carry no data-tip, since the
       decision to show anything at all depends on a measurement. Without it, one click anywhere in
       the component (opening a drilldown, sorting, paging) silenced every truncation tooltip until
       the user happened to hover some unrelated icon button. */
    function unsuppress(){ S.suppressed = false; }
    return { showTip: showTip, showTipText: showTipText, showTipWide: showTipWide,
             hideTip: hideTip, unsuppress: unsuppress, el: tip };
  }

  /* ---- topic color palette + emoji library ----
     Extracted from topics-manager.js/prompts-table.js, which each carried a byte-identical copy
     (per STYLEGUIDE §25: duplicate first, extract once a SECOND consumer needs the exact same
     thing — prompts-table's own "Add Topic" button opening this same modal is that second
     consumer). Rows are tone bands (vibrant/muted/deep), columns are hues — scanning down picks a
     mood, across picks a color. Only hex_light is ever rendered anywhere in the app, so these are
     tuned to read acceptably in BOTH themes at once rather than getting a per-theme pass. */
  var TOPIC_COLOR_PALETTE = [
    /* vibrant */ "#de1b22", "#b65616", "#8d6a11", "#108440", "#107c84", "#1b6eda", "#9145e8", "#d51a8b", "#666666", "#7d7d7d",
    /* muted   */ "#b47476", "#a87b5d", "#988552", "#4f926b", "#509195", "#6a88af", "#977ab8", "#b27098", "#787878", "#949494",
    /* deep    */ "#ab2b2f", "#8b4c23", "#725a1d", "#1b6a3c", "#1b656a", "#295ea3", "#7a33cc", "#a32972", "#575757", "#666666"
  ];
  function swatchInk(hex){
    var h = String(hex).replace("#", "");
    function lin(c){ c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    var y = 0.2126 * lin(h.slice(0,2)) + 0.7152 * lin(h.slice(2,4)) + 0.0722 * lin(h.slice(4,6));
    return y > 0.179 ? "#151515" : "#ffffff";
  }
  var EMOJI_LIB_URL = "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";
  var emojiLibPromise = null;
  function ensureEmojiLib(){
    if (window.customElements && window.customElements.get("emoji-picker")) return;
    if (emojiLibPromise) return;
    emojiLibPromise = true;
    var s = document.createElement("script");
    s.type = "module";
    s.textContent = 'import "' + EMOJI_LIB_URL + '";';
    document.head.appendChild(s);
  }

  var CLOSE_SVG_TM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var SMILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';

  /* ---- shared topic create/edit modal ----
     One modal, two consumers: topics-manager (create + edit + delete, its own page) and
     prompts-table's "Add Topic" button (create only, no delete — the caller simply never passes
     onDelete). Deliberately does NOT fire any Bubble event itself and does NOT know the word
     "selection" — it only ever hands the caller a clean draft {name, emoji, hex_light, hex_dark}
     (+ id when editing) via cfg.onSave, and lets the caller decide what event name / extra fields
     (a bulk selection payload, in prompts-table's case) to wrap it in. This is exactly why it
     can't hardcode data-add-fn/data-edit-fn the way it used to when it only lived in
     topics-manager.js — the two callers fire completely different events with different payload
     shapes for what is, from the modal's point of view, the identical "user finished a draft" action.
     Body-mounted (position:fixed backdrop) for the same reason the bulk-bar and every other
     document.body-mounted surface in this library is: it must never be clipped by whatever
     Bubble container happens to hold the component that opened it. Not routed through
     UC.makePopover — that primitive's open() closes every OTHER popover on the page, which is
     right for a corner dropdown but wrong for a true modal (opening a dropdown elsewhere must not
     silently close this). Hand-rolled instead: blur focus before hiding (aria-hidden-on-ancestor-
     of-focused-element is a Chrome accessibility trap), plus its own Escape listener scoped to
     just this modal instance. */
  function makeTopicModal(cfg){
    cfg = cfg || {};
    var getIsDark = cfg.getIsDark || function(){ return false; };
    var palette = cfg.palette || TOPIC_COLOR_PALETTE;
    var onSave = cfg.onSave || function(){};
    var onDelete = cfg.onDelete || null;

    var modalBackdrop = null, modalOpenerEl = null;
    var modalMode = null;        // null | "create" | "edit"
    var modalTopic = null;
    var draftName = "", draftEmoji = "", draftColor = null;
    var pickOpen = null;         // null | "emoji" | "color"
    var modalSaving = false, modalSaveTimer = null;

    function pickerRowHtml(){
      var color = draftColor || palette[0];
      var emojiOpen = pickOpen === "emoji";
      var colorOpen = pickOpen === "color";
      var panel = "";
      if (emojiOpen){
        panel = '<div class="up-topicmodal-pickpanel"><emoji-picker class="up-topicmodal-emojipicker ' + (getIsDark() ? "dark" : "light") + '"></emoji-picker></div>';
      } else if (colorOpen){
        panel = '<div class="up-topicmodal-pickpanel"><div class="up-topicmodal-colorgrid">' +
          palette.map(function(hx){
            var on = hx === color;
            return '<button type="button" class="up-topicmodal-colorcell" data-color="' + esc(hx) + '"' +
              ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
              '<span class="up-topicmodal-colorblob" style="background:' + esc(hx) +
                (on ? ";color:" + swatchInk(hx) : "") + '">' + (on ? CHECK_SVG : "") + '</span>' +
            '</button>';
          }).join("") +
        '</div></div>';
      }
      return '<div class="up-topicmodal-approw">' +
          '<button type="button" class="up-topicmodal-pickbtn' + (emojiOpen ? " is-open" : "") +
            '" data-pick="emoji" data-tip="Topic Emoji" aria-label="Topic emoji" aria-expanded="' + (emojiOpen ? "true" : "false") + '">' +
            (draftEmoji ? esc(draftEmoji) : SMILE_SVG) +
          '</button>' +
          '<button type="button" class="up-topicmodal-pickbtn' + (colorOpen ? " is-open" : "") +
            '" data-pick="color" data-tip="Topic Color" aria-label="Topic color" aria-expanded="' + (colorOpen ? "true" : "false") + '">' +
            '<span class="up-topicmodal-pickswatch" style="background:' + esc(color) + '"></span>' +
          '</button>' +
        '</div>' + panel;
    }
    function renderAppearance(){
      var wrap = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-approw-wrap");
      if (wrap) wrap.innerHTML = pickerRowHtml();
    }
    function syncSaveEnabled(){
      var saveBtn = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-save");
      if (saveBtn) saveBtn.disabled = !draftName.trim();
    }
    function deleteArmed(){
      var b = modalBackdrop && modalBackdrop.querySelector(".up-topicmodal-delete");
      return !!(b && b.classList.contains("is-armed"));
    }
    function ensureModal(){
      if (modalBackdrop && document.body.contains(modalBackdrop)) return modalBackdrop;
      modalBackdrop = document.createElement("div");
      modalBackdrop.className = "up-topicmodal-backdrop";
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalBackdrop.innerHTML =
        '<div class="up-topicmodal-card" role="dialog" aria-modal="true" aria-labelledby="up-topicmodal-title-' + Math.random().toString(36).slice(2) + '">' +
          '<div class="up-topicmodal-head">' +
            '<div class="up-topicmodal-heading">' +
              '<h2 class="up-topicmodal-title"></h2>' +
            '</div>' +
            '<button type="button" class="up-topicmodal-close" data-modal-close aria-label="Close">' + CLOSE_SVG_TM + '</button>' +
          '</div>' +
          '<div class="up-topicmodal-body">' +
            '<div class="up-topicmodal-field">' +
              '<label class="up-topicmodal-label">Name</label>' +
              '<input type="text" class="up-topicmodal-name" maxlength="60" autocomplete="off" spellcheck="false"/>' +
            '</div>' +
            '<div class="up-topicmodal-field">' +
              '<label class="up-topicmodal-label">Appearance</label>' +
              '<div class="up-topicmodal-approw-wrap"></div>' +
            '</div>' +
          '</div>' +
          '<div class="up-topicmodal-foot"></div>' +
        '</div>';

      var nameInput = modalBackdrop.querySelector(".up-topicmodal-name");
      nameInput.addEventListener("input", function(){ draftName = nameInput.value; syncSaveEnabled(); });

      modalBackdrop.addEventListener("click", function(e){
        if (e.target === modalBackdrop){ closeModal(); return; }
        if (e.target.closest("[data-modal-close]")){ closeModal(); return; }
        if (e.target.closest("[data-modal-save]")){ saveModal(); return; }
        var delBtn = e.target.closest("[data-modal-delete]");
        if (delBtn){
          if (!deleteArmed()){
            modalBackdrop.querySelector(".up-topicmodal-delete").classList.add("is-armed");
            modalBackdrop.querySelector(".up-topicmodal-delete").textContent = "Confirm delete?";
            return;
          }
          fireDelete();
          return;
        }
        var pickBtn = e.target.closest("[data-pick]");
        if (pickBtn){
          var kind = pickBtn.getAttribute("data-pick");
          pickOpen = pickOpen === kind ? null : kind;
          if (pickOpen === "emoji") ensureEmojiLib();
          renderAppearance();
          return;
        }
        var colorBtn = e.target.closest("[data-color]");
        if (colorBtn){ draftColor = colorBtn.getAttribute("data-color"); renderAppearance(); return; }
      });
      /* emoji-picker-element dispatches this (bubbling, composed) from inside its shadow root. */
      modalBackdrop.addEventListener("emoji-click", function(e){
        var unicode = e.detail && e.detail.unicode;
        if (!unicode) return;
        draftEmoji = unicode;
        renderAppearance();   // deliberately does not close the picker
      });
      /* Scoped to just this modal, not a page-global Escape (which would close every open
         popover) — this modal's Escape must not, say, also close an unrelated sort menu open
         elsewhere on the page, nor should some other component's Escape reach in and close it. */
      document.addEventListener("keydown", function(e){
        if (!modalMode) return;
        if (e.key !== "Escape" && e.key !== "Esc") return;
        closeModal();
      });
      makeTooltips(modalBackdrop, getIsDark);
      document.body.appendChild(modalBackdrop);
      return modalBackdrop;
    }
    function openModal(mode, topic){
      ensureModal();
      modalMode = mode; modalTopic = topic || null;
      draftName = topic ? String(topic.name || "") : "";
      draftEmoji = topic ? String(topic.emoji || "") : "";
      draftColor = topic ? String(topic.hex_light || topic.hex_dark || palette[0]) : palette[0];
      if (draftColor.charAt(0) !== "#") draftColor = "#" + draftColor;
      pickOpen = null; modalSaving = false;
      clearTimeout(modalSaveTimer);
      modalBackdrop.setAttribute("data-theme", getIsDark() ? "dark" : "light");
      var titleEl = modalBackdrop.querySelector(".up-topicmodal-title");
      if (titleEl) titleEl.textContent = mode === "create" ? "New Topic" : "Edit Topic";
      var nameInput = modalBackdrop.querySelector(".up-topicmodal-name");
      if (nameInput) nameInput.value = draftName;
      var foot = modalBackdrop.querySelector(".up-topicmodal-foot");
      if (foot){
        foot.innerHTML = (mode === "edit" && onDelete
          ? '<button type="button" class="up-topicmodal-delete" data-modal-delete>Delete</button>'
          : "") +
          '<button type="button" class="up-topicmodal-save" data-modal-save' + (draftName.trim() ? "" : " disabled") + '>Save</button>';
      }
      renderAppearance();
      modalOpenerEl = document.activeElement;
      modalBackdrop.setAttribute("aria-hidden", "false");
      void modalBackdrop.offsetWidth;   // force layout flush so the appear transition actually runs
      modalBackdrop.classList.add("is-shown");
      setTimeout(function(){ try { nameInput.focus(); nameInput.select(); } catch(e){} }, 60);
    }
    function closeModal(){
      if (!modalBackdrop || !modalMode) return;
      /* Blur focus BEFORE hiding: aria-hidden on an ancestor of the focused element is an
         accessibility trap, and Chrome refuses it outright with a console error. */
      if (modalBackdrop.contains(document.activeElement)){
        try { document.activeElement.blur(); } catch(e){}
      }
      modalBackdrop.classList.remove("is-shown");
      modalBackdrop.setAttribute("aria-hidden", "true");
      modalMode = null; modalTopic = null;
      clearTimeout(modalSaveTimer); modalSaving = false;
      try { if (modalOpenerEl && modalOpenerEl.focus) modalOpenerEl.focus(); } catch(e){}
      modalOpenerEl = null;
    }
    function saveModal(){
      var name = draftName.trim();
      if (!name || modalSaving) return;
      var payload = { name: name, emoji: draftEmoji || "", hex_light: draftColor || palette[0], hex_dark: draftColor || palette[0] };
      if (modalMode === "edit" && modalTopic) payload.id = String(modalTopic.id);
      modalSaving = true;
      var saveBtn = modalBackdrop.querySelector(".up-topicmodal-save");
      if (saveBtn){ saveBtn.disabled = true; saveBtn.style.opacity = ".6"; }
      onSave(payload, modalMode, modalTopic);
      /* Nothing else in this library waits mid-interaction on a round trip — every table's
         search/sort/filter updates the local view optimistically and never blocks a control on
         the response. A mutation genuinely has to wait for Bubble's RPC before the modal can
         close (there's no optimistic id to show yet on create), so this is the one place with a
         "saving" state — with a generous timeout so a dropped/failed RPC can't trap the user in
         a stuck modal forever. The caller is expected to call .close() itself once its RPC
         answers (by re-rendering, same as everywhere else); this timer is only the fallback. */
      clearTimeout(modalSaveTimer);
      modalSaveTimer = setTimeout(function(){
        modalSaving = false;
        if (saveBtn){ saveBtn.disabled = !draftName.trim(); saveBtn.style.opacity = ""; }
      }, 8000);
    }
    function fireDelete(){
      if (!modalTopic || !onDelete) return;
      onDelete(modalTopic);
      closeModal();
    }
    return {
      open: openModal, close: closeModal,
      isOpen: function(){ return !!modalMode; },
      /* The render/update path needs to tell "modal is open because the user is mid-edit" apart
         from "modal is open AND its save is in flight, so THIS incoming re-render is very likely
         the RPC answer — close it" without reaching into the closure. */
      isSaving: function(){ return modalSaving; },
      /* The modal is parented to document.body, so it does NOT go away with the component's own
         markup when Bubble rebuilds the element — the caller's own destroy() must remove it
         explicitly or it lingers as an orphan over the next instance. */
      destroy: function(){
        if (modalBackdrop && modalBackdrop.parentNode) modalBackdrop.parentNode.removeChild(modalBackdrop);
        modalBackdrop = null;
      }
    };
  }

  /* Shared event dispatch: resolves the Bubble function (via the data-*-fn attr or a fallback
     name) across window/parent/top/iframes and calls it with the JSON payload. label + eventPrefix
     stay per component so warnings and the DOM side-channel event read correctly. */
  function makeFire(root, opts){
    opts = opts || {};
    var label = opts.label || "component";
    var evtPrefix = opts.eventPrefix || "";
    return function fire(attr, fallbackName, payload){
      var fnName = root.getAttribute(attr) || fallbackName;
      var fn = resolveBubbleFn(fnName);
      var json; try { json = JSON.stringify(payload); } catch(e){ json = ""; }
      if (typeof fn === "function"){ try { fn(json); } catch(e){} }
      else if (window.console) {
        console.warn("[" + label + "] " + fnName + " not found on window/parent/top or any reachable " +
          "iframe — this action reached no Bubble workflow. Check the Toolbox element's name.");
      }
      try { root.dispatchEvent(new CustomEvent(evtPrefix + fallbackName, { detail: payload, bubbles: true })); } catch(e){}
    };
  }

  /* Dropdown menus stay exactly where they are in the markup: a plain position:absolute child of a
     position:relative wrapper (.up-sort / .up-filter / .up-cols / .up-ment, etc. — all already
     position:relative in core.css, all with the menu positioned via `top:calc(100% + Npx); right:0`).
     That's pure CSS layout, so the menu moves in the SAME paint as its trigger when the page
     scrolls — glued, by construction, with zero JavaScript and therefore zero possibility of
     lag or jitter.

     Earlier versions moved every menu into a <body>-level layer and switched it to position:fixed
     so it could escape an ancestor's overflow:hidden clipping, then re-ran a JS reposition on every
     scroll event to chase the trigger. No matter how that reposition was optimized (rAF-throttled,
     then compositor-only transform nudges), a JS scroll-follow is inherently one step behind the
     scroll it reacts to, so the menu visibly drifted / sprang against its trigger while scrolling.
     Not worth it: a menu that tracks its trigger perfectly beats one that's robust against a
     clipping failure mode we haven't actually hit here (the pre-migration components used plain
     position:absolute and were never clipped in practice).

     Kept as a no-op shell — the menus already live inside the root, so there is nothing to move.
     Existing call sites keep working unchanged, including their syncPortalTheme() calls; the theme
     now reaches the menus through the normal cascade (.up-root[data-theme="dark"] .xxx-menu),
     because the menus are still inside the themed root. */
  function makePortal(root, menuEls, instanceId){
    return { portalLayer: null, syncPortalTheme: function(){} };
  }

  /* No-op: dropdown menus are positioned entirely by CSS now (position:absolute against their
     position:relative wrapper — see makePortal). Kept as a callable shell so the components that
     call it on open don't need to change; the CSS rest-state already places the menu correctly. */
  function placeMenu(menu, btn, opts){}

  /* ---------- makePopover ----------
     Open/close mechanics for every dropdown in the library. There were four different versions of
     this (each table's, visibility-chart's, topcitations', and citations-combo-chart's), which is
     why one of them ended up hard-toggling `display` — breaking the "menu always stays in the
     layout" rule in STYLEGUIDE §6 — and why only some of them restore focus or revert drafts.

     Registration is page-global so ONE document click listener serves every popover on the page,
     instead of one listener per menu per instance as before.

     cfg: { wrap, menu, opener?, onClose?(committed), group? }
       wrap   — the position:relative element that gets .is-open
       menu   — the position:absolute child that gets .is-shown + aria-hidden
       opener — the trigger button (focus is moved off it before hiding, so the menu can't be
                re-opened by a stray Enter on a now-hidden control)
       onClose(committed) — called on every close; `committed` is false unless close(true) was
                used, which is how a component reverts unapplied draft state.
       group  — only scopes an explicit UC.closePopovers(except, group) call. Opening a popover
                always closes every other one on the page regardless of group: two open dropdowns
                is never a state we want. */
  var POPOVERS = (window.__upPopovers = window.__upPopovers || []);
  function makePopover(cfg){
    var wrap = cfg.wrap, menu = cfg.menu;
    if (!wrap || !menu) return { open: function(){}, close: function(){}, toggle: function(){}, isOpen: function(){ return false; } };
    var rec = { wrap: wrap, menu: menu, opener: cfg.opener || null, onClose: cfg.onClose || null, group: cfg.group || null };
    for (var i = 0; i < POPOVERS.length; i++){ if (POPOVERS[i].wrap === wrap){ POPOVERS.splice(i, 1); break; } }
    POPOVERS.push(rec);

    function isOpen(){ return wrap.classList.contains("is-open"); }
    function close(committed){
      if (!isOpen()) return;
      /* move focus off anything inside the menu BEFORE hiding it — a focused element inside a
         hidden subtree is an accessibility trap and keeps swallowing keystrokes */
      try {
        var a = document.activeElement;
        if (a && menu.contains(a)){ if (rec.opener && rec.opener.focus) rec.opener.focus(); else a.blur(); }
        if (rec.opener && document.activeElement === rec.opener && rec.opener.blur) rec.opener.blur();
      } catch(e){}
      wrap.classList.remove("is-open");
      menu.classList.remove("is-shown");
      menu.setAttribute("aria-hidden", "true");
      if (rec.onClose) { try { rec.onClose(!!committed); } catch(e){} }
    }
    function open(){
      if (isOpen()) return;
      /* Closes EVERY other popover on the page, not just this component's. Two dropdowns open at
         once is never wanted, and scoping this by group meant a menu in one component stayed open
         while you opened one in another. Relying on the outside-click listener for that is not
         enough either: several openers call stopPropagation(), so that click never reaches the
         document handler — closing here is the reliable path. */
      closeAll(wrap, null);
      wrap.classList.add("is-open");
      menu.classList.add("is-shown");
      menu.setAttribute("aria-hidden", "false");
    }
    function toggle(){ if (isOpen()) close(false); else open(); }
    return { open: open, close: close, toggle: toggle, isOpen: isOpen, el: wrap };
  }
  function closeAll(exceptWrap, group){
    for (var i = 0; i < POPOVERS.length; i++){
      var p = POPOVERS[i];
      if (p.wrap === exceptWrap) continue;
      if (group && p.group && p.group !== group) continue;
      if (!p.wrap.classList.contains("is-open")) continue;
      if (!document.contains(p.wrap)){ POPOVERS.splice(i--, 1); continue; }   // stale after a rebuild
      p.wrap.classList.remove("is-open");
      p.menu.classList.remove("is-shown");
      p.menu.setAttribute("aria-hidden", "true");
      if (p.onClose) { try { p.onClose(false); } catch(e){} }
    }
  }
  if (!window.__upPopoverGlobalBound){
    window.__upPopoverGlobalBound = true;
    document.addEventListener("click", function(e){
      for (var i = 0; i < POPOVERS.length; i++){
        var p = POPOVERS[i];
        if (!document.contains(p.wrap)){ POPOVERS.splice(i--, 1); continue; }
        if (!p.wrap.classList.contains("is-open")) continue;
        if (p.wrap.contains(e.target)) continue;   // click inside the trigger or the menu itself
        p.wrap.classList.remove("is-open");
        p.menu.classList.remove("is-shown");
        p.menu.setAttribute("aria-hidden", "true");
        if (p.onClose) { try { p.onClose(false); } catch(err){} }
      }
    });
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" && e.keyCode !== 27) return;
      closeAll(null, null);
    });
  }

  /* Walks a root's ancestors and neutralizes any overflow:hidden/clip it finds (stopping at the
     first real scroll container, or body/html) — Bubble frequently wraps a component in a plain
     group div that clips overflow with no scrolling of its own, which cuts off anything the
     component tries to render OUTSIDE its own box: a position:sticky header trying to escape, or
     — just as often — a plain position:absolute dropdown menu that needs to hang below a short
     component. Marks what it touches via a data-up-unclipped attribute (storing the prior inline
     value) so restore(true) can put it back. Originally private to makeSticky (only useful when
     sticky was ACTUALLY engaged); pulled out standalone because dropdown clipping has nothing to
     do with whether the header happens to be sticky — a component with no sticky header at all
     (topics-manager, no data-sticky-top concept) still needs its sort/filter menus to escape a
     short host container, and shouldn't have to fake-enable sticky positioning just to get the
     side effect. */
  function unclipAncestors(root, restore){
    var el = root.parentElement, guard = 0;
    while (el && el !== document.body && el !== document.documentElement && guard++ < 40){
      var cs; try { cs = window.getComputedStyle(el); } catch(e){ break; }
      var oy = cs.overflowY;
      if (oy === "auto" || oy === "scroll" || oy === "overlay") break;   // the scroll container: leave it
      var clips = (cs.overflow === "hidden" || cs.overflow === "clip" ||
                   cs.overflowX === "hidden" || cs.overflowX === "clip" ||
                   oy === "hidden" || oy === "clip");
      if (restore){
        if (el.hasAttribute("data-up-unclipped")){ el.style.overflow = el.getAttribute("data-up-unclipped") || ""; el.removeAttribute("data-up-unclipped"); }
      } else if (clips && !el.hasAttribute("data-up-unclipped")){
        el.setAttribute("data-up-unclipped", el.style.overflow || "");
        el.style.overflow = "visible";
      }
      el = el.parentElement;
    }
  }

  /* Collapses a burst of calls into one per animation frame, keeping the LAST call's arguments.
     Resize and pointermove both fire faster than the screen refreshes, so anything that measures
     or writes layout in response wants this — otherwise the same work runs several times to
     produce one visible frame, which is exactly how a resize starts feeling like it runs at a
     fraction of the real frame rate. Deliberately trailing-edge: the final event of a burst is
     the one whose state is correct. */
  function rafThrottle(fn){
    var pending = null, lastArgs = null, lastThis = null;
    return function(){
      lastArgs = arguments; lastThis = this;
      if (pending) return;
      pending = requestAnimationFrame(function(){
        pending = null;
        fn.apply(lastThis, lastArgs);
      });
    };
  }

  /* Sticky header machinery: pins the toolbar + column header at data-sticky-top on wide screens,
     un-clips overflow:hidden ancestors (Bubble wrappers) so position:sticky isn't trapped, and
     keeps --up-thead-off in sync with the toolbar height. Returns applySticky (wire to resize) and
     syncTheadOffset (call after the header height can change). */
  function makeSticky(root, headEl){
    function syncTheadOffset(){ if (headEl) root.style.setProperty("--up-thead-off", headEl.offsetHeight + "px"); }
    function applySticky(){
      var pageW = window.innerWidth || document.documentElement.clientWidth || 0;
      var on = root.getAttribute("data-sticky") !== "no" && pageW >= 1000;
      var v = root.getAttribute("data-sticky-top"); if (v) root.style.setProperty("--up-sticky-top", /^[0-9]+$/.test(v) ? v + "px" : v);
      root.classList.toggle("up-sticky", on);
      unclipAncestors(root, !on);
      if (on) syncTheadOffset();
    }
    /* The intermittent "only the toolbar sticks, the column header scrolls away with the table"
       bug: every syncTheadOffset() call above only fires from explicit call sites (component
       init, resize, and each render()) — none of which fire again if the toolbar's real height
       changes for a reason that ISN'T one of those triggers. Two real ones: Geist (core.css's own
       @import, ...&display=swap) loads asynchronously and can swap in — changing glyph metrics —
       after the first measurement already ran; a brand logo <img> in the toolbar (data-brand-name)
       finishes loading and un-collapses its box on the same kind of delay. Either way
       --up-thead-off is left stuck at whatever the toolbar measured BEFORE it settled — .up-root's
       own 32px fallback (set once, before any JS runs) if that first measurement was early enough
       — and for a toolbar this tall, sticking that many px too high lands the thead UNDERNEATH the
       (correctly positioned) toolbar rather than below it: exactly "the heading isn't there, only
       the toolbar is" while scrolling. Switching tabs or reloading "fixes" it purely because
       whatever was still loading has finished by then, so THAT render's own remeasure happens to
       land on the right number — not because anything was actually fixed. A ResizeObserver on the
       toolbar itself re-measures the instant its real height changes for ANY reason, removing the
       race instead of relying on it resolving by coincidence on some later render. */
    if (headEl && window.ResizeObserver){
      var lastTheadOffH = null;
      new ResizeObserver(function(){
        if (!root.classList.contains("up-sticky")) return;
        var h = headEl.offsetHeight;
        if (h === lastTheadOffH) return;
        lastTheadOffH = h;
        syncTheadOffset();
      }).observe(headEl);
    }
    return { applySticky: applySticky, syncTheadOffset: syncTheadOffset };
  }

  /* Bubble re-injects a component's whole markup block (script tags included) whenever the
     reusable it lives in re-renders, so every component needs some way to notice "my root just
     reappeared in the DOM" and re-run its init. Each of the four components used to set this up
     independently: its own document.body MutationObserver (childList+subtree — i.e. "wake up on
     ANY DOM change anywhere on the page") plus its own setInterval(initAll, 1500) heartbeat. On a
     page that places two or more of these components that's 2-4 separate whole-page observers and
     timers all doing redundant work forever, and every one of them re-fires on totally unrelated
     DOM churn elsewhere on the page (another reusable's appear animation, a repeating group
     re-rendering, Mira's own UI) — exactly the kind of background tax that shows up as animations
     feeling slightly less smooth than a plain standalone HTML embed had.

     The shared registry/observer/interval live on WINDOW, not in this module's closure — because
     each component loads its own copy of core.js, so this IIFE runs once PER component (and again
     on every Bubble re-render of a component). Keeping the state module-scoped meant each core.js
     execution built its OWN whole-page observer + interval, quietly re-creating the exact 2-4
     redundant observers this consolidation exists to prevent. On window there is provably ONE
     observer + ONE interval + ONE watcher list for the whole page, no matter how many times
     core.js is evaluated.

     The observer's per-mutation work is also coalesced: any relevant DOM change schedules a SINGLE
     rAF-batched pass over the watchers instead of running each watcher's init synchronously inside
     every mutation callback — so a burst of mutations during a drawer/slide-in open (Bubble
     rendering a whole subtree at once) collapses to one cheap pass per frame. */
  function watchRoots(rootSelector, onRootsFound){
    var G = window.__upRootWatch;
    if (!G) G = window.__upRootWatch = { watchers: [], obs: null, iv: null, pending: false };
    for (var e = 0; e < G.watchers.length; e++){
      if (G.watchers[e].selector === rootSelector) return;   // already registered by some core.js execution
    }
    G.watchers.push({ selector: rootSelector, onFound: onRootsFound });

    function runAll(){
      G.pending = false;
      for (var k = 0; k < G.watchers.length; k++){ try { G.watchers[k].onFound(); } catch(e){} }
    }
    function scheduleAll(){
      if (G.pending) return;
      G.pending = true;
      if (window.requestAnimationFrame) window.requestAnimationFrame(runAll); else setTimeout(runAll, 16);
    }

    if (!G.obs && window.MutationObserver){
      G.obs = new MutationObserver(function(muts){
        for (var i = 0; i < muts.length; i++){
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++){
            var n = added[j];
            if (n.nodeType !== 1) continue;
            for (var w = 0; w < G.watchers.length; w++){
              var sel = G.watchers[w].selector;
              /* first relevant node anywhere in the batch → schedule one coalesced pass and stop
                 scanning; the per-component initAll each pass runs is itself cheap + idempotent. */
              if ((n.classList && n.classList.contains(sel)) ||
                  (n.querySelector && n.querySelector("." + sel))){ scheduleAll(); return; }
            }
          }
        }
      });
      G.obs.observe(document.body, { childList: true, subtree: true });
    }
    if (!G.iv){
      G.iv = setInterval(runAll, 1500);
    }
  }

  /* ==========================================================================================
     CHART KITS
     ==========================================================================================
     Every chart in this library is one of exactly three shapes: a multi-series line chart, a
     doughnut, or a horizontal bar list. Before these kits existed, each shape was copy-pasted
     into every component that needed it — visibility-chart and citations-combo-chart carried two
     near-identical ~376-line line charts, topcitations-dashboard and citations-combo-chart two
     near-identical ~200-line doughnut/bar charts. That duplication is what let the same bug get
     fixed in one component and stay broken in another (the multi-instance tooltip bug, the
     theme-sticky doughnut tooltip, the missing highlight easing — all found the hard way).

     What lives HERE: everything that is presentation or interaction — Chart.js plugins, the
     external tooltips, skeletons, the container-size poll, the render-verify retry, the legend
     layout algorithm, animation curves, the watermark.
     What stays in the COMPONENT: only the data mapping — turning a Bubble payload into
     {labels, datasets} or into [{name, share, color}]. That genuinely differs per component
     (visibility-chart keys on company_id with a fixed palette, citations-combo-chart keys on
     domain/url with a generated shade ramp), so it is passed in, not guessed at here. */

  /* Loads Chart.js once per PAGE, shared across every upstreem component. Loading it twice
     breaks existing chart instances (each load replaces window.Chart with a fresh registry), so
     if another component already injected it we wait for that copy instead of adding a second. */
  function loadChartJs(){
    if (window.Chart) return Promise.resolve();
    if (window.__upstreemChartJs) return window.__upstreemChartJs;
    window.__upstreemChartJs = new Promise(function(res, rej){
      var existing = document.querySelector('script[data-upstreem-chartjs], script[data-ccchart], script[src*="chart.umd"], script[src*="chart.js@"], script[src*="chart.local"]');
      if (existing){
        var iv = setInterval(function(){ if (window.Chart){ clearInterval(iv); res(); } }, 40);
        setTimeout(function(){ clearInterval(iv); if (window.Chart) res(); else rej(new Error("chartjs timeout")); }, 10000);
        return;
      }
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
      s.setAttribute("data-upstreem-chartjs", "1");
      s.onload = function(){ res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return window.__upstreemChartJs;
  }

  /* ---------- chart colour system ----------
     Citation types have a genuine dark accent, not the same hex reused on both themes. This was
     previously local to topcitations-dashboard, which meant citations-combo-chart rendered
     light-mode citation hexes in dark mode. Shared now so that cannot drift again.
     CHART_OTHER_* are deliberately NOT the same values as OTHER_LIGHT/OTHER_DARK above:
     the chart palette's neutral is #a0a0a0, the chip palette's is #a8abb2. Same idea, different
     tuning; keeping both avoids silently shifting a colour nobody asked to change. */
  var CITE_COLOR_DARK = {
    "Editorial":"#5cd7c8", "UGC / Community":"#62b4da", "Knowledge-Base":"#8082db",
    "Brand Platforms":"#c377cf", "Institutional":"#7693bb", "Competition":"#de8c54", "You":"#d76f82"
  };
  var URL_LABEL = {
    homepage:"Homepage", product_service:"Product / Service", marketplace:"Marketplace", company_info:"Company Info",
    article:"Article", listicle:"Listicle", guide:"Guide", comparison:"Comparison", review:"Review",
    documentation:"Documentation", forum:"Forum", directory:"Directory", video:"Video", social_post:"Social Post", other:"Uncategorized"
  };
  /* bright chart-fill palette, tuned for large area fills — deliberately separate from URL_TYPE
     above, which is tuned for small text-on-tint chips. */
  var URL_COLOR_CHART = {
    homepage:"#c3753a", product_service:"#ce8662", marketplace:"#ae7c58", company_info:"#b48139",
    article:"#369379", listicle:"#3e90a6", guide:"#5182ef", comparison:"#726bea", review:"#8a53e1",
    documentation:"#8a53e1", forum:"#a95cee", directory:"#b549bf", video:"#9661f1", social_post:"#a27df8", other:"#8c8f96"
  };
  var URL_COLOR_DARK = {
    homepage:"#fbbf24", product_service:"#fdba74", marketplace:"#fcae6f", company_info:"#facc15",
    article:"#6ee7b7", listicle:"#67e8f9", guide:"#93c5fd", comparison:"#a5b4fc", review:"#c4b5fd",
    documentation:"#c4b5fd", forum:"#d8b4fe", directory:"#f0abfc", video:"#c4b5fd", social_post:"#ddd6fe", other:"#a0a0a0"
  };
  var CHART_OTHER_LIGHT = "#8c8f96", CHART_OTHER_DARK = "#a0a0a0";
  var MAX_URL_SLICES = 8;

  /* Slice/line colour for a raw type key. mode: "url" | anything else (= citation type). */
  function typeColor(raw, mode, isDark){
    if (mode === "url"){
      var map = isDark ? URL_COLOR_DARK : URL_COLOR_CHART;
      return map[String(raw || "").trim()] || (isDark ? CHART_OTHER_DARK : CHART_OTHER_LIGHT);
    }
    var name = citeName(raw);
    return isDark ? (CITE_COLOR_DARK[name] || CHART_OTHER_DARK) : (CITE_COLOR[name] || CHART_OTHER_LIGHT);
  }
  function capitalize(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* Share formatter with the <1% case fmtTotal doesn't have. */
  function fmtPct(v){ v = Number(v) || 0; if (v > 0 && v < 1) return "<1%"; return Math.round(v) + "%"; }

  /* Turns a raw [{type, share_pct}] breakdown into the [{name, share, color}] the doughnut/bar
     renderers take. In url mode the tail past MAX_URL_SLICES is folded into one "Other" slice. */
  function prepTypeData(mode, rows, isDark){
    rows = Array.isArray(rows) ? rows : [];
    var items = rows
      .filter(function(r){ return r && (r.type != null) && isFinite(Number(r.share_pct)); })
      .map(function(r){ return { key: String(r.type).trim(), share: Math.max(0, Number(r.share_pct)) }; });
    if (mode === "url"){
      items.sort(function(a, b){ return b.share - a.share; });
      if (items.length > MAX_URL_SLICES){
        var head = items.slice(0, MAX_URL_SLICES);
        var otherShare = items.slice(MAX_URL_SLICES).reduce(function(a, b){ return a + b.share; }, 0);
        head.push({ key: "other", share: otherShare, _other: true });
        items = head;
      }
      return items.map(function(it){
        return {
          key: it.key,
          name: it._other ? "Other" : (URL_LABEL[it.key] || capitalize(String(it.key).replace(/_/g, " "))),
          share: it.share,
          color: it._other ? (isDark ? CHART_OTHER_DARK : CHART_OTHER_LIGHT) : typeColor(it.key, "url", isDark)
        };
      });
    }
    return items.map(function(it){
      return { key: it.key, name: citeName(it.key), share: it.share, color: typeColor(it.key, "citation", isDark) };
    });
  }
  /* Grey out every slice/bar whose key isn't in `sel` — the shared half of "click a type chart
     segment to filter by it" (topcitations-dashboard's filter-menu checkboxes AND its chart-click
     shortcut both funnel through this). `__dimmed`/`__realColor` ride along on every greyed item
     so a hover state (makeTypeChart) or a tooltip (makeDonutTooltip) can tell "this is currently
     filtered out" from "this is its real, always-was-grey color" and react differently — a
     tooltip name and a hover state both still need the REAL colour even while the paint itself
     is dimmed. */
  function applyTypeDim(prepped, sel, isDark){
    var selectedKeys = Object.keys(sel || {}).filter(function(k){ return sel[k]; });
    if (!selectedKeys.length) return prepped;
    var selSet = {};
    selectedKeys.forEach(function(k){ selSet[k] = true; });
    var grey = isDark ? "#3a3a3a" : "#e0e2e6";
    return prepped.map(function(it){
      return (it.key != null && selSet[it.key]) ? it : { key: it.key, name: it.name, share: it.share, color: grey, __dimmed: true, __realColor: it.color };
    });
  }

  /* Would white label text be hard to read on this fill? WCAG relative luminance, so it judges by
     hue too (a light yellow reads bright, a light blue less so). Threshold sits high on purpose:
     only genuinely light bars flip to dark text, mid-tone citation fills keep white. */
  function barIsLight(col){
    if (typeof col !== "string") return false;
    var c = col.charAt(0) === "#" ? col.slice(1) : col;
    if (c.length === 3) c = c.charAt(0)+c.charAt(0)+c.charAt(1)+c.charAt(1)+c.charAt(2)+c.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return false;
    function lin(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    var L = 0.2126*lin(parseInt(c.substr(0,2),16)) + 0.7152*lin(parseInt(c.substr(2,2),16)) + 0.0722*lin(parseInt(c.substr(4,2),16));
    return L > 0.55;
  }
  /* Intrinsic text width via an off-DOM probe. Deliberately NOT getBoundingClientRect(): the bar
     labels are measured while still opacity:0 inside a 0%-wide flex fill, so their box width is
     the clipped width, not the width the text actually needs. */
  function measureText(el){
    if (!el) return 0;
    var cs = window.getComputedStyle(el);
    var probe = document.createElement("span");
    probe.textContent = el.textContent;
    probe.style.cssText = "position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;" +
      "font-family:" + cs.fontFamily + ";font-size:" + cs.fontSize + ";font-weight:" + cs.fontWeight + ";letter-spacing:" + cs.letterSpacing + ";";
    document.body.appendChild(probe);
    var w = probe.offsetWidth;
    document.body.removeChild(probe);
    return w;
  }
  function truncate(s, n){ s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n-1) + "…" : s; }
  var MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function chartDateFmt(day){
    var m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day || "");
    return parseInt(m[3],10) + " " + MONTHS[parseInt(m[2],10)-1] + " " + m[1];
  }
  /* Tooltip header date. At month granularity a full "1 Jul 2026" reads wrong for what is really
     a whole-month bucket, so it collapses to just the month name. */
  function chartDateTitle(day, gran){
    var m = String(day || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day || "");
    if (gran === "month") return MONTHS_LONG[parseInt(m[2],10)-1] || chartDateFmt(day);
    return chartDateFmt(day);
  }
  function getPageWidth(){
    try { if (window.top && window.top.innerWidth) return window.top.innerWidth; } catch(e){}
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  /* ---------- watermark ----------
     Injected by the line kit into its own wrap. Used to be a separate per-component script file
     with its own whole-page MutationObserver + 300ms interval hunting for wraps by class; the kit
     owns its wrap element directly, so none of that scanning is needed. Idempotent. */
  var WM_PATH_TEXT = "M195.928 128.536C190.979 128.536 186.669 127.512 183 125.464C179.331 123.331 176.472 120.173 174.424 115.992C172.461 111.811 171.48 106.52 171.48 100.12V63.512H184.28V98.84C184.28 104.984 185.56 109.677 188.12 112.92C190.765 116.077 194.605 117.656 199.64 117.656C203.139 117.656 206.211 116.845 208.856 115.224C211.501 113.517 213.592 111.085 215.128 107.928C216.749 104.685 217.56 100.845 217.56 96.408V63.512H230.36V127H219.224L218.072 117.016H217.56C215.427 120.429 212.568 123.203 208.984 125.336C205.4 127.469 201.048 128.536 195.928 128.536ZM241.26 152.6V63.512H252.012L252.908 75.416H253.42C255.297 72.4293 257.431 69.9547 259.82 67.992C262.295 66.0293 265.068 64.536 268.14 63.512C271.212 62.488 274.497 61.976 277.996 61.976C284.055 61.976 289.303 63.4267 293.74 66.328C298.263 69.2293 301.719 73.1973 304.108 78.232C306.583 83.2667 307.82 88.9413 307.82 95.256C307.82 101.571 306.583 107.245 304.108 112.28C301.719 117.315 298.22 121.283 293.612 124.184C289.004 127.085 283.415 128.536 276.844 128.536C271.212 128.536 266.519 127.384 262.764 125.08C259.009 122.776 256.108 120.173 254.06 117.272V152.6H241.26ZM274.54 117.656C278.721 117.656 282.305 116.717 285.292 114.84C288.364 112.963 290.711 110.36 292.332 107.032C294.039 103.704 294.892 99.7787 294.892 95.256C294.892 90.8187 294.039 86.936 292.332 83.608C290.711 80.1947 288.364 77.5493 285.292 75.672C282.305 73.7947 278.721 72.856 274.54 72.856C270.444 72.856 266.86 73.7947 263.788 75.672C260.716 77.5493 258.327 80.1947 256.62 83.608C254.999 86.936 254.188 90.8187 254.188 95.256C254.188 99.7787 254.999 103.704 256.62 107.032C258.327 110.36 260.716 112.963 263.788 114.84C266.86 116.717 270.444 117.656 274.54 117.656ZM341.336 128.536C336.131 128.536 331.48 127.64 327.384 125.848C323.288 124.056 319.96 121.581 317.4 118.424C314.925 115.181 313.432 111.384 312.92 107.032H325.848C326.36 108.995 327.171 110.872 328.28 112.664C329.475 114.456 331.139 115.949 333.272 117.144C335.491 118.253 338.179 118.808 341.336 118.808C344.152 118.808 346.456 118.424 348.248 117.656C350.125 116.803 351.491 115.693 352.344 114.328C353.283 112.963 353.752 111.469 353.752 109.848C353.752 107.885 353.112 106.307 351.832 105.112C350.637 103.832 348.888 102.765 346.584 101.912C344.365 100.973 341.677 100.077 338.52 99.224C335.875 98.456 333.187 97.6453 330.456 96.792C327.725 95.8533 325.251 94.744 323.032 93.464C320.813 92.184 319.021 90.52 317.656 88.472C316.291 86.3387 315.608 83.736 315.608 80.664C315.608 77.1653 316.547 74.008 318.424 71.192C320.387 68.376 323.16 66.1573 326.744 64.536C330.328 62.8293 334.595 61.976 339.544 61.976C346.541 61.976 352.216 63.6827 356.568 67.096C361.005 70.424 363.608 75.2453 364.376 81.56H351.96C351.619 78.4027 350.339 75.9707 348.12 74.264C345.987 72.5573 343.085 71.704 339.416 71.704C335.832 71.704 333.059 72.472 331.096 74.008C329.219 75.544 328.28 77.464 328.28 79.768C328.28 81.304 328.792 82.584 329.816 83.608C330.84 84.632 332.419 85.528 334.552 86.296C336.771 86.9787 339.501 87.832 342.744 88.856C346.84 90.0507 350.68 91.3733 354.264 92.824C357.933 94.2747 360.877 96.1947 363.096 98.584C365.4 100.888 366.552 104.088 366.552 108.184C366.637 112.109 365.613 115.608 363.48 118.68C361.432 121.752 358.531 124.184 354.776 125.976C351.021 127.683 346.541 128.536 341.336 128.536ZM397.988 127C393.977 127 390.436 126.36 387.364 125.08C384.377 123.8 382.073 121.667 380.452 118.68C378.916 115.693 378.148 111.64 378.148 106.52V73.112H367.14V63.512H378.148L379.556 47.64H390.948V63.512H408.996V73.112H390.948V106.648C390.948 110.659 391.673 113.347 393.124 114.712C394.66 116.077 397.305 116.76 401.06 116.76H408.228V127H397.988ZM414.745 127V63.512H425.881L427.033 77.336H427.545C429.593 72.8133 431.641 69.4853 433.689 67.352C435.822 65.1333 438.254 63.6827 440.985 63C443.801 62.3173 447.129 61.976 450.969 61.976V75.416H447.641C444.313 75.416 441.369 75.8427 438.809 76.696C436.334 77.464 434.244 78.6587 432.537 80.28C430.916 81.9013 429.678 83.992 428.825 86.552C427.972 89.0267 427.545 91.9707 427.545 95.384V127H414.745ZM484.822 128.536C478.593 128.536 473.089 127.171 468.31 124.44C463.531 121.624 459.777 117.741 457.046 112.792C454.315 107.843 452.95 102.04 452.95 95.384C452.95 88.728 454.273 82.9253 456.918 77.976C459.649 72.9413 463.403 69.016 468.182 66.2C473.046 63.384 478.635 61.976 484.95 61.976C491.265 61.976 496.683 63.384 501.206 66.2C505.729 68.9307 509.227 72.5573 511.702 77.08C514.262 81.6027 515.542 86.6373 515.542 92.184C515.542 93.0373 515.542 93.976 515.542 95C515.542 96.024 515.457 97.0907 515.286 98.2H462.294V89.24H502.742C502.486 83.7787 500.694 79.5547 497.366 76.568C494.038 73.496 489.857 71.96 484.822 71.96C481.409 71.96 478.209 72.728 475.222 74.264C472.321 75.8 469.974 78.104 468.182 81.176C466.39 84.248 465.494 88.1307 465.494 92.824V96.408C465.494 101.101 466.39 105.069 468.182 108.312C469.974 111.469 472.321 113.859 475.222 115.48C478.209 117.101 481.366 117.912 484.694 117.912C488.79 117.912 492.161 117.016 494.806 115.224C497.537 113.347 499.542 110.829 500.822 107.672H513.75C512.555 111.683 510.635 115.267 507.99 118.424C505.345 121.496 502.059 123.971 498.134 125.848C494.294 127.64 489.857 128.536 484.822 128.536ZM553.197 128.536C546.968 128.536 541.464 127.171 536.685 124.44C531.906 121.624 528.152 117.741 525.421 112.792C522.69 107.843 521.325 102.04 521.325 95.384C521.325 88.728 522.648 82.9253 525.293 77.976C528.024 72.9413 531.778 69.016 536.557 66.2C541.421 63.384 547.01 61.976 553.325 61.976C559.64 61.976 565.058 63.384 569.581 66.2C574.104 68.9307 577.602 72.5573 580.077 77.08C582.637 81.6027 583.917 86.6373 583.917 92.184C583.917 93.0373 583.917 93.976 583.917 95C583.917 96.024 583.832 97.0907 583.661 98.2H530.669V89.24H571.117C570.861 83.7787 569.069 79.5547 565.741 76.568C562.413 73.496 558.232 71.96 553.197 71.96C549.784 71.96 546.584 72.728 543.597 74.264C540.696 75.8 538.349 78.104 536.557 81.176C534.765 84.248 533.869 88.1307 533.869 92.824V96.408C533.869 101.101 534.765 105.069 536.557 108.312C538.349 111.469 540.696 113.859 543.597 115.48C546.584 117.101 549.741 117.912 553.069 117.912C557.165 117.912 560.536 117.016 563.181 115.224C565.912 113.347 567.917 110.829 569.197 107.672H582.125C580.93 111.683 579.01 115.267 576.365 118.424C573.72 121.496 570.434 123.971 566.509 125.848C562.669 127.64 558.232 128.536 553.197 128.536ZM591.62 127V63.512H602.884L604.036 74.008H604.548C606.596 69.9973 609.369 67.0107 612.868 65.048C616.452 63 620.377 61.976 624.644 61.976C627.972 61.976 630.959 62.4453 633.604 63.384C636.335 64.3227 638.681 65.7307 640.644 67.608C642.607 69.4853 644.228 71.8747 645.508 74.776H646.02C648.324 70.5947 651.268 67.4373 654.852 65.304C658.436 63.0853 662.873 61.976 668.164 61.976C672.943 61.976 677.081 63.0427 680.58 65.176C684.164 67.224 686.98 70.3387 689.028 74.52C691.076 78.7013 692.1 83.992 692.1 90.392V127H679.428V91.672C679.428 85.528 678.191 80.8773 675.716 77.72C673.241 74.4773 669.487 72.856 664.452 72.856C661.209 72.856 658.393 73.5387 656.004 74.904C653.615 76.184 651.695 78.232 650.244 81.048C648.879 83.7787 648.196 87.32 648.196 91.672V127H635.524V91.672C635.524 85.528 634.287 80.8773 631.812 77.72C629.337 74.4773 625.711 72.856 620.932 72.856C618.031 72.856 615.343 73.7093 612.868 75.416C610.393 77.0373 608.345 79.4267 606.724 82.584C605.188 85.7413 604.42 89.5813 604.42 94.104V127H591.62Z";
  var WM_PATH_MARK = "M83.7971 91.7952C83.7971 98.5594 85.6493 101.942 89.3538 101.942C92.5789 101.942 96.1744 100.053 100.14 96.2765C103.67 92.838 106.765 88.554 109.423 83.4245C111.384 83.2554 112.365 84.2982 112.365 86.5529C112.365 88.4694 111.45 91.4006 109.619 95.3464C107.833 99.2922 106.089 102.703 104.39 105.577C102.69 108.452 100.794 111.271 98.7019 114.033C96.6102 116.795 94.3876 119.275 92.0341 121.473C86.7607 126.321 81.618 128.745 76.606 128.745C69.0227 128.745 63.9672 125.25 61.4394 118.26C56.6454 122.883 51.5899 126.067 46.2729 127.815C44.4424 128.435 42.394 128.745 40.1277 128.745C37.9051 128.745 35.6824 128.238 33.4597 127.223C31.2806 126.152 29.4066 124.63 27.8376 122.657C24.6125 118.599 23 113.018 23 105.916C23 97.9675 25.0919 89.625 29.2758 80.8878C32.7624 73.6163 37.2078 67.1903 42.612 61.6098C47.5803 56.5366 51.5899 54 54.6407 54C56.2967 54 58.1708 55.6911 60.2628 59.0732C55.9917 62.9626 52.309 67.9231 49.2146 73.9545C45.7716 80.6624 44.0502 86.722 44.0502 92.1334C44.0502 98.6722 46.1639 101.942 50.3914 101.942C54.5753 101.942 57.8657 101.011 60.2628 99.1513C61.9624 90.3578 65.7759 81.2824 71.703 71.9252C77.5866 62.6244 82.969 56.7903 87.8502 54.4228C89.4192 53.69 91.5547 54.6482 94.2568 57.2976C94.9105 57.9176 95.4117 58.4531 95.7604 58.9041C92.0559 63.019 89.0487 68.5995 86.7389 75.6455C84.7776 81.6207 83.7971 87.0039 83.7971 91.7952Z";
  function injectWatermark(wrap){
    if (!wrap || wrap.querySelector(".upstreem-watermark")) return;
    var W = 150, H = W * (184 / 707);
    /* pick black or white from the nearest ancestor that actually paints a background */
    var color = "#000", node = wrap;
    while (node){
      var bg; try { bg = getComputedStyle(node).backgroundColor; } catch(e){ break; }
      var m = bg && bg.match(/rgba?\(([^)]+)\)/);
      if (m){
        var p = m[1].split(",").map(function(s){ return parseFloat(s); });
        var a = p[3] == null ? 1 : p[3];
        if (a > 0){ color = (0.299*p[0] + 0.587*p[1] + 0.114*p[2]) < 128 ? "#fff" : "#000"; break; }
      }
      node = node.parentElement;
    }
    try { if (getComputedStyle(wrap).position === "static") wrap.style.position = "relative"; } catch(e){}
    /* The mask id MUST be unique per watermark: several charts can live on one page, and duplicate
       ids make every SVG resolve url(#…) to the FIRST match — when that one isn't usable the mask
       silently fails and the rect paints unmasked (a grey box on every instance but the first). */
    var id = "up-wm-" + Math.random().toString(36).slice(2) + "-" + (+new Date());
    var wm = document.createElement("div");
    wm.className = "upstreem-watermark";
    wm.style.cssText = "position:absolute;top:47%;left:50%;transform:translate(-50%,-50%);width:" + W +
      "px;height:" + H + "px;opacity:0.05;color:" + color + ";pointer-events:none;z-index:2;";
    wm.innerHTML =
      '<svg viewBox="0 0 707 184" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style="display:block">' +
        '<defs><mask id="' + id + '">' +
          '<path fill="#fff" d="' + WM_PATH_TEXT + '"/>' +
          '<rect x="4" y="32" width="120" height="120" rx="28" fill="#fff"/>' +
          '<path fill="#000" d="' + WM_PATH_MARK + '"/>' +
        '</mask></defs>' +
        '<rect width="707" height="184" fill="currentColor" mask="url(#' + id + ')"/>' +
      '</svg>';
    wrap.appendChild(wm);
  }

  /* ---------- line chart ---------- */
  var LINE_TENSION = 0.3, LINE_POINT_HOVER = 4, LINE_POINT_HIT = 6, LINE_POINT_BORDER = 1.4;
  var X_MAX_TICKS = 7, Y_PAD = 1.15;
  /* Line width is a page-wide preference, not per-component/per-instance — one localStorage key
     read by every makeLine() chart, changeable from any of their own Chart Settings dropdowns.
     "thin" is the original 1.5px this shipped with, kept as the default so nothing already
     deployed shifts appearance until someone actually opens the setting and changes it. "thick"
     is the midpoint between thin and the first version's 2.75px, not that value itself — 2.75
     read as too heavy in practice. */
  var LINE_WIDTH_VALUES = { thin: 1.5, thick: 2.125 };
  var LINE_WIDTH_KEY = "up_line_width_pref";
  function getLineWidthPref(){
    try { return window.localStorage.getItem(LINE_WIDTH_KEY) === "thick" ? "thick" : "thin"; }
    catch(e){ return "thin"; }
  }
  function setLineWidthPref(v){
    v = v === "thick" ? "thick" : "thin";
    try { window.localStorage.setItem(LINE_WIDTH_KEY, v); } catch(e){}
    /* Every currently-mounted makeLine() chart on the page — including ones belonging to OTHER
       component instances — listens for this and redraws immediately with its last-built data,
       so changing it from one chart's settings menu is felt everywhere without a page reload. */
    try { window.dispatchEvent(new CustomEvent("up-linewidth-change", { detail: { value: v } })); } catch(e){}
  }
  var LW_THIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/></svg>';
  var LW_THICK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/></svg>';
  /* Same visual family as UC.makeColumns's row-height switch (.up-pop-div/.up-pop-sub/.up-dense/
     .up-dense-btn) — a settings dropdown that already has ITS OWN row-height 2-way switch and one
     that has a Line Width switch should look like the same kind of control, not two different
     idioms for "pick one of two". Every line-chart component's settings menu gets this same
     section appended; only visibility-chart's menu additionally offers Colors above it. */
  function lineWidthSectionHtml(){
    var pref = getLineWidthPref();
    return '<div class="up-pop-div"></div>' +
      '<div class="up-pop-sub">Line Width</div>' +
      '<div class="up-dense">' +
        '<button class="up-dense-btn' + (pref === "thin" ? " is-active" : "") + '" type="button" data-linewidth="thin">' + LW_THIN_SVG + 'Thin</button>' +
        '<button class="up-dense-btn' + (pref === "thick" ? " is-active" : "") + '" type="button" data-linewidth="thick">' + LW_THICK_SVG + 'Thick</button>' +
      '</div>';
  }

  var hoverLinePlugin = {
    id: "upHoverLine",
    afterDatasetsDraw: function(chart){
      var act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act || !act.length) return;
      var x = act[0].element.x, ca = chart.chartArea, ctx = chart.ctx;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, ca.top); ctx.lineTo(x, ca.bottom);
      ctx.lineWidth = 1; ctx.strokeStyle = chart.$upHoverLineColor || "rgba(0,0,0,0.12)";
      ctx.stroke(); ctx.restore();
    }
  };
  /* dashed horizontal grid at every y tick, drawn behind the lines (Chart.js's own grid can't do
     the zero-line exception this design wants) */
  var dashedYGridPlugin = {
    id: "upDashedYGrid",
    beforeDatasetsDraw: function(chart){
      var y = chart.scales.y, ca = chart.chartArea, ctx = chart.ctx;
      if (!y || !ca) return;
      var ticks = (y.getTicks && y.getTicks()) || y.ticks || [];
      if (!ticks.length) return;
      ctx.save();
      ctx.setLineDash([6,6]); ctx.lineWidth = 1; ctx.strokeStyle = chart.$upGridColor || "rgba(0,0,0,0.08)";
      ticks.forEach(function(t){
        if (t.value <= 0) return;   // no gridline on the zero line
        var yp = y.getPixelForValue(t.value);
        if (yp == null || isNaN(yp)) return;
        if (yp < ca.top - 0.5 || yp > ca.bottom + 0.5) return;
        ctx.beginPath(); ctx.moveTo(ca.left, Math.round(yp) + 0.5); ctx.lineTo(ca.right, Math.round(yp) + 0.5); ctx.stroke();
      });
      ctx.restore();
    }
  };

  /* index-mode tooltip: every series at the hovered day, sorted desc, with a date header and
     favicon rows. Eases toward its target instead of snapping, so sweeping across the chart reads
     as one object following the cursor rather than a box teleporting per data point. */
  function makeLineTooltip(wrap, getIsDark, getGran){
    var pos = { x:null, y:null }, target = { x:0, y:0 }, running = false, visible = false;
    var FOLLOW = 0.18;
    function loop(){
      var el = wrap.querySelector(".up-line-tt");
      if (pos.x == null){ pos.x = target.x; pos.y = target.y; }
      pos.x += (target.x - pos.x) * FOLLOW;
      pos.y += (target.y - pos.y) * FOLLOW;
      if (el) el.style.transform = "translate3d(" + pos.x + "px," + pos.y + "px,0)";
      var dx = Math.abs(target.x - pos.x), dy = Math.abs(target.y - pos.y);
      if (visible || dx > 0.4 || dy > 0.4){ requestAnimationFrame(loop); }
      else { running = false; }
    }
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = wrap.querySelector(".up-line-tt");
      if (!el){
        el = document.createElement("div");
        el.className = "up-line-tt";
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
        wrap.appendChild(el);
      }
      if (tooltip.opacity === 0){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dps = (tooltip.dataPoints || []).filter(function(dp){ return dp && dp.parsed && dp.parsed.y != null; });
      if (!dps.length){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dark = !!getIsDark();
      var boxBg = dark ? "#121212" : "#ffffff";
      var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
      var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      var mutedColor = dark ? "#8a8a8a" : "#6f737c";
      var dayLabel = chart.data.labels[dps[0].dataIndex];
      dps = dps.slice().sort(function(a, b){ return b.parsed.y - a.parsed.y; });
      var ff = "Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial";
      var rows = dps.map(function(dp){
        var ds = dp.dataset;
        var icon = ds.__favicon
          ? '<img src="' + esc(ds.__favicon) + '" width="16" height="16" style="border-radius:4px;display:block;object-fit:cover" onerror="this.style.visibility=\'hidden\'"/>'
          : '<span style="width:16px;height:16px;border-radius:4px;background:' + ds.__baseColor + ';display:block"></span>';
        var vy = Number(dp.parsed.y) || 0, vr = Math.round(vy);
        var val = (vy > 0 && vr === 0) ? "<1%" : (vr + "%");
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
            '<span style="flex:0 0 16px;display:flex">' + icon + '</span>' +
            '<span style="flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + textColor + '">' + esc(truncate(ds.label, 32)) + '</span>' +
            '<span style="flex:0 0 auto;margin-left:77px;color:' + textColor + ';font-weight:500">' + val + '</span>' +
          '</div>';
      }).join("");
      el.innerHTML =
        '<div style="background:' + boxBg + ';color:' + textColor + ';' + boxBorder + 'border-radius:16px;padding:10px 12px;font-family:' + ff + ';font-size:13px;line-height:1.35;' + boxShadow + 'white-space:nowrap;min-width:220px;">' +
          '<div style="color:' + mutedColor + ';font-size:11px">' + esc(chartDateTitle(dayLabel, getGran ? getGran() : "day")) + '</div>' +
          rows +
        '</div>';
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + (tooltip.caretX != null ? tooltip.caretX : dps[0].element.x), m = 16;
      el.style.left = "0px"; el.style.top = "0px";
      var rect = el.getBoundingClientRect();
      var tx = (caretX + rect.width + m > cx + ca.right) ? (caretX - rect.width - m) : (caretX + m);
      tx = Math.max(cx + ca.left, Math.min(tx, cx + ca.right - rect.width));
      var ty = Math.max(cy + ca.top, Math.min(cy + ca.top + 8, cy + ca.bottom - rect.height));
      target.x = tx; target.y = ty;
      if (pos.x == null){ pos.x = tx; pos.y = ty; el.style.transform = "translate3d(" + tx + "px," + ty + "px,0)"; }
      el.style.opacity = "1"; visible = true;
      if (!running){ running = true; requestAnimationFrame(loop); }
    };
  }

  function lineSkeletonHtml(){
    var hlines = "", xlabels = "", i;
    for (i = 0; i < 4; i++) hlines += '<div class="sk-lc-hline"></div>';
    for (i = 0; i < 6; i++) xlabels += '<div class="sk-lc-xlabel"></div>';
    var d = "M0,125 C60,115 100,70 150,58 C200,46 230,90 280,74 C330,58 390,22 460,14";
    var agId = "up-sk-ag-" + Math.random().toString(36).slice(2);
    return '<div class="up-line-sk"><div class="sk-linechart">' +
      '<div class="sk-lc-grid">' + hlines +
        '<svg class="sk-lc-svg" viewBox="0 0 460 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
          '<defs><linearGradient id="' + agId + '" x1="0" y1="0" x2="0" y2="1"><stop class="sk-lc-astop0" offset="0%"/><stop class="sk-lc-astop1" offset="100%"/></linearGradient></defs>' +
          '<path d="' + d + ' L460,160 L0,160 Z" fill="url(#' + agId + ')"/>' +
          '<path class="sk-lc-stroke" d="' + d + '"/>' +
          '<path class="sk-lc-shimmer-path" d="' + d + '"/>' +
        '</svg>' +
      '</div>' +
      '<div class="sk-lc-xaxis">' + xlabels + '</div>' +
    '</div></div>';
  }

  /* ---------- line legend: balanced rows ----------
     Greedy wrapping leaves an ugly widow row (5 items, then 1). This packs the items into at most
     two rows minimising the WIDEST row, via a small DP over the break positions. */
  var LEG_MIN_GAP = 8, LEG_MAX_GAP = 16;
  function legGetColumnGap(w){ return Math.max(LEG_MIN_GAP, Math.min(LEG_MAX_GAP, Math.floor(w * 0.025))); }
  function legNormalizeUrl(url){ if (!url) return ""; if (url.indexOf("//") === 0) return "https:" + url; return url; }
  function legItemHtml(c, measure){
    return '<div class="up-company-item' + (measure ? " up-measure-item" : "") + '" data-company-id="' + esc(c.company_id) + '">' +
        '<span class="up-company-color" style="background:' + esc(c.color || "#999999") + '"></span>' +
        '<span class="up-company-inner-gap"></span>' +
        (c.favicon_url
          ? '<img class="up-company-favicon" src="' + esc(legNormalizeUrl(c.favicon_url)) + '" alt="" onerror="this.style.visibility=\'hidden\'">'
          : '<span class="up-company-favicon" style="visibility:hidden"></span>') +
        '<span class="up-company-inner-gap"></span>' +
        '<span class="up-company-name">' + esc(c.name) + '</span>' +
      '</div>';
  }
  function legRowWidth(widths, start, end, gap){
    var total = 0;
    for (var i = start; i < end; i++){ total += widths[i]; if (i > start) total += gap; }
    return total;
  }
  function legGreedyRowCount(widths, cw, gap){
    var rows = 1, cur = 0;
    for (var i = 0; i < widths.length; i++){
      var next = cur === 0 ? widths[i] : cur + gap + widths[i];
      if (cur > 0 && next > cw){ rows++; cur = widths[i]; } else { cur = next; }
    }
    return rows;
  }
  function legBalancedBreaks(widths, rowCount, cw, gap){
    var n = widths.length;
    if (rowCount <= 1 || n <= 1) return [];
    var dp = [], prev = [], r, i, k;
    for (r = 0; r <= rowCount; r++){
      dp.push(new Array(n + 1)); prev.push(new Array(n + 1));
      for (i = 0; i <= n; i++){ dp[r][i] = Infinity; prev[r][i] = -1; }
    }
    dp[0][0] = 0;
    for (r = 1; r <= rowCount; r++){
      for (i = 1; i <= n; i++){
        for (k = r - 1; k < i; k++){
          var w = legRowWidth(widths, k, i, gap);
          if (w > cw) continue;
          var score = Math.max(dp[r-1][k], w);
          if (score < dp[r][i]){ dp[r][i] = score; prev[r][i] = k; }
        }
      }
    }
    if (!isFinite(dp[rowCount][n])) return [];
    var breaks = [], ii = n;
    for (r = rowCount; r > 1; r--){ var kk = prev[r][ii]; if (kk <= 0) break; breaks.unshift(kk); ii = kk; }
    return breaks;
  }

  /* ---------- makeLine ----------
     cfg: { wrap, canvas, legend, isDark(), isOwner(), gran(), watermark:bool }
     The component builds {labels, datasets}; datasets must carry __id / __baseColor / __favicon.
     Returns { render, skeleton, empty, destroy, resize, relayoutLegend, chart }. */
  function makeLine(cfg){
    var wrap = cfg.wrap, canvas = cfg.canvas, legendEl = cfg.legend || null;
    var isDark = cfg.isDark || function(){ return false; };
    var isOwner = cfg.isOwner || function(){ return true; };
    var chart = null, legendCompanies = [], verifyT = null, sizeIv = null, lastBuilt = null;
    /* Redraw with whatever data is already on screen — no refetch — the moment ANY chart on the
       page (this instance's own dropdown or another component's) changes the shared line-width
       preference. Bound once per instance, not per render: this closure lives as long as the
       component does, same as the resize/click listeners the color-scale dropdown binds below. */
    window.addEventListener("up-linewidth-change", function(){
      if (!isOwner() || !chart || !lastBuilt) return;
      build(lastBuilt);
    });

    function themeColors(){
      return isDark()
        ? { text:"#e0e0e0", muted:"#a0a0a0", border:"#353535", bg:"#1b1b1b" }
        : { text:"#1f1f1b", muted:"#6f737c", border:"#e0e2e6", bg:"#ffffff" };
    }
    function clearExtras(){
      var sk = wrap.querySelector(".up-line-sk"); if (sk) sk.remove();
      var em = wrap.querySelector(".up-line-empty"); if (em) em.remove();
    }
    function destroy(){
      if (sizeIv){ clearInterval(sizeIv); sizeIv = null; }
      clearTimeout(verifyT);
      if (chart){ try { chart.destroy(); } catch(e){} chart = null; }
      if (window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(canvas); if (ex) try { ex.destroy(); } catch(e){} }
      /* The external tooltip is a plain DOM element outside Chart.js's lifecycle — destroying the
         chart stops the callback that would set its opacity back to 0, so a tooltip left visible
         from a hover right before a reload would stay stuck on screen. */
      var tt = wrap.querySelector(".up-line-tt");
      if (tt) tt.style.opacity = "0";
    }
    function clearLegend(){ if (legendEl){ legendCompanies = []; legendEl.innerHTML = ""; } }

    function legendLayout(){
      if (!legendEl) return;
      if (getPageWidth() < 500){ legendEl.classList.add("is-hidden"); return; }
      legendEl.classList.remove("is-hidden");
      var rowsC = legendEl.querySelector(".up-company-rows");
      var measure = Array.prototype.slice.call(legendEl.querySelectorAll(".up-measure-item"));
      if (!rowsC || !measure.length) return;
      var cw = legendEl.clientWidth;
      if (!cw){ setTimeout(legendLayout, 100); return; }
      var gap = legGetColumnGap(cw);
      legendEl.style.setProperty("--up-column-gap", gap + "px");
      var widths = measure.map(function(it){ return it.getBoundingClientRect().width; });
      var rowCount = legGreedyRowCount(widths, cw, gap);
      rowCount = Math.max(1, Math.min(rowCount, legendCompanies.length, 2));   // never more than 2 rows
      var breaks = legBalancedBreaks(widths, rowCount, cw, gap);
      /* if 2 balanced rows don't fit (items too wide even truncated), split at the midpoint */
      if (rowCount === 2 && !breaks.length) breaks = [Math.ceil(legendCompanies.length / 2)];
      var rows = [], start = 0, b;
      for (b = 0; b < breaks.length; b++){ rows.push(legendCompanies.slice(start, breaks[b])); start = breaks[b]; }
      rows.push(legendCompanies.slice(start));
      rowsC.innerHTML = rows.map(function(row){
        return '<div class="up-company-row">' + row.map(function(c){ return legItemHtml(c, false); }).join("") + '</div>';
      }).join("");
    }
    function renderLegend(datasets){
      if (!legendEl) return;
      legendCompanies = (datasets || []).map(function(ds){
        return { company_id: ds.__id, name: ds.label, color: ds.__baseColor, favicon_url: ds.__favicon };
      });
      if (!legendCompanies.length){ legendEl.innerHTML = ""; return; }
      legendEl.innerHTML =
        '<div class="up-company-measure">' + legendCompanies.map(function(c){ return legItemHtml(c, true); }).join("") + '</div>' +
        '<div class="up-company-rows"></div>';
      legendLayout();
    }
    /* highlight one series on legend hover: active keeps its colour, everything else dims */
    function applyHighlight(id){
      if (chart && chart.__activeId !== id){
        chart.__activeId = id;
        var dim = isDark() ? "rgba(160,160,160,0.20)" : "rgba(120,123,124,0.22)";
        chart.data.datasets.forEach(function(ds){
          ds.borderColor = (id == null || ds.__id === id) ? ds.__baseColor : dim;
        });
        chart.update("highlight");   // named transition, see options.transitions below
      }
      if (legendEl){
        var items = legendEl.querySelectorAll(".up-company-item");
        for (var i = 0; i < items.length; i++){
          items[i].style.opacity = (id == null || items[i].getAttribute("data-company-id") === id) ? "1" : "0.35";
        }
      }
    }
    /* bound once via delegation — rows are re-rendered on every resize */
    if (legendEl && legendEl.getAttribute("data-up-hoverbound") !== "1"){
      legendEl.setAttribute("data-up-hoverbound", "1");
      legendEl.addEventListener("mouseover", function(e){
        var it = e.target && e.target.closest ? e.target.closest(".up-company-item") : null;
        if (it) applyHighlight(it.getAttribute("data-company-id"));
      });
      legendEl.addEventListener("mouseleave", function(){ applyHighlight(null); });
    }

    function skeleton(){
      destroy(); clearExtras(); clearLegend();
      wrap.insertAdjacentHTML("beforeend", lineSkeletonHtml());
      if (cfg.watermark !== false) injectWatermark(wrap);
    }
    function empty(msg){
      destroy(); clearExtras(); clearLegend();
      wrap.insertAdjacentHTML("beforeend", '<div class="up-line-empty">' + esc(msg || "No data") + '</div>');
      if (cfg.watermark !== false) injectWatermark(wrap);
    }

    function build(built){
      destroy();
      var tc = themeColors();
      var ctx = canvas.getContext("2d");
      window.Chart.defaults.color = tc.muted;
      window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
      var labels = built.labels, ds = built.datasets;
      var single = labels.length <= 1;   // single-day range → show the values as points
      ds.forEach(function(d){
        d.borderWidth = LINE_WIDTH_VALUES[getLineWidthPref()]; d.fill = false; d.cubicInterpolationMode = "monotone"; d.tension = LINE_TENSION;
        d.pointRadius = single ? 4 : 0; d.pointHoverRadius = LINE_POINT_HOVER; d.pointHitRadius = LINE_POINT_HIT;
        d.pointBorderWidth = LINE_POINT_BORDER; d.pointBackgroundColor = single ? d.__baseColor : tc.bg;
        d.pointBorderColor = d.__baseColor; d.pointHoverBackgroundColor = tc.bg; d.pointHoverBorderColor = d.__baseColor;
        d.spanGaps = true; d.clip = 8;
      });
      var visMax = 0;
      ds.forEach(function(d){ (d.data || []).forEach(function(v){ if (v != null && v > visMax) visMax = v; }); });
      var yMax = visMax * Y_PAD; if (yMax <= 0) yMax = 1; if (yMax > 100) yMax = 100;
      try {
        chart = new window.Chart(ctx, {
          type: "line",
          data: { labels: labels, datasets: ds },
          plugins: [hoverLinePlugin, dashedYGridPlugin],
          options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 600, easing: "easeOutQuart" },
            /* separate, faster curve for the legend-hover cross-highlight than the initial draw */
            transitions: { highlight: { animation: { duration: 200, easing: "easeOutQuad" } } },
            interaction: { mode: "index", intersect: false },
            layout: { padding: { top: 8, right: 2, bottom: 0, left: 0 } },
            plugins: { legend: { display: false }, tooltip: { enabled: false, external: makeLineTooltip(wrap, isDark, cfg.gran) } },
            scales: {
              x: { grid: { display:false }, offset: single, border: { display:true, color: tc.border, width:1 },
                   ticks: { autoSkip:true, maxTicksLimit:X_MAX_TICKS, maxRotation:0, color: tc.muted,
                            callback: function(v, i){
                              var lab = String(labels[i] || "");
                              if (cfg.gran && cfg.gran() === "month"){
                                var m = lab.match(/^(\d{4})-(\d{2})/);
                                if (m) return MONTHS_LONG[parseInt(m[2],10) - 1] || lab;
                              }
                              return lab.slice(5);   // day / week → "MM-DD"
                            } } },
              y: { min:0, max:yMax, beginAtZero:true,
                   afterBuildTicks: function(scale){ var m = scale.max || 1; scale.ticks = [{value:0},{value:m/3},{value:2*m/3},{value:m}]; },
                   ticks: { color: tc.muted, callback: function(v){ return Math.round(v) + "%"; } },
                   grid: { display:false }, border: { display:false } }
            },
            elements: { point: { radius: 0 } }
          }
        });
        chart.$upGridColor = tc.border;
        chart.$upHoverLineColor = tc.border;
      } catch(err){}
    }

    /* Chart.js reads the canvas's live layout to compute where the entrance animation starts, so
       it needs a container with real, settled dimensions at creation time — not just "attached".
       Two situations defeat that: (1) Chart.js was already cached so this .then() runs as an
       immediate microtask before the browser laid out a freshly re-inserted widget; (2) the root
       sits inside a Bubble element hidden via display:none, which reports 0x0 forever until shown.
       Building against that collapsed geometry replays as points flying in from the (0,0) corner.
       Deliberately setInterval, not rAF/ResizeObserver: both of those are tied to the rendering
       pipeline, which browsers pause for a backgrounded or hidden tab — exactly when a Bubble
       popup sits unopened. setInterval keeps ticking (throttled, not paused). */
    function buildWhenSized(built){
      if (wrap.clientWidth > 0 && wrap.clientHeight > 0){ build(built); return; }
      var ticks = 0;
      if (sizeIv) clearInterval(sizeIv);
      sizeIv = setInterval(function(){
        if (!isOwner() || !canvas || !canvas.isConnected){ clearInterval(sizeIv); sizeIv = null; return; }
        if ((wrap.clientWidth > 0 && wrap.clientHeight > 0) || ++ticks > 600){   // ~2 min cap
          clearInterval(sizeIv); sizeIv = null;
          build(built);
        }
      }, 200);
    }
    /* Chart.js's internals occasionally fail to attach silently (a race in its own resize
       observer). Re-check a few times and rebuild if the canvas ends up with no live instance. */
    function verify(built){
      clearTimeout(verifyT);
      var attempts = 0;
      function check(){
        if (!isOwner()) return;
        var alive = false;
        try { alive = !!(window.Chart && window.Chart.getChart && canvas && window.Chart.getChart(canvas)); } catch(e){}
        if (alive || wrap.querySelector(".up-line-empty")) return;
        if (attempts++ >= 12) return;
        buildWhenSized(built);
        verifyT = setTimeout(check, 250);
      }
      verifyT = setTimeout(check, 400);
    }

    function render(built){
      if (!isOwner()) return;
      clearExtras();
      if (!built || !built.datasets || !built.datasets.length){ empty(); return; }
      lastBuilt = built;
      renderLegend(built.datasets);
      if (cfg.watermark !== false) injectWatermark(wrap);
      loadChartJs().then(function(){
        if (!isOwner() || !canvas) return;
        buildWhenSized(built);
        verify(built);
      })["catch"](function(){});
    }

    return {
      render: render,
      skeleton: skeleton,
      empty: empty,
      destroy: destroy,
      relayoutLegend: legendLayout,
      /* exposed because a component can drive the same highlight from outside the legend —
         visibility-chart cross-highlights the line when you hover the matching table row.
         Pass null to clear. */
      highlight: applyHighlight,
      resize: function(){ try { if (chart) chart.resize(); } catch(e){} },
      chart: function(){ return chart; }
    };
  }

  /* ---------- doughnut + bars ---------- */
  var RING_PX = 12, SEG_GAP = 6, CORNER = 4, HOVER = 12;
  var ringWidthPlugin = {
    id: "upRingWidth",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      meta.data.forEach(function(arc){ arc.innerRadius = Math.max(1, arc.outerRadius - RING_PX); });
    }
  };
  /* Chart.js spaces slices proportionally, so a 1% slice gets a hairline gap and a 40% slice a
     wide one. This redistributes the angles so every gap is the same number of pixels. */
  var constantGapPlugin = {
    id: "upConstantGap",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      if (!meta || !meta.data || !meta.data.length) return;
      var r = (meta.data[0] && meta.data[0].outerRadius) || 100;
      var gap = SEG_GAP / r, N = meta.data.length;
      var available = (Math.PI*2) - gap*N;
      var total = meta.total || chart.data.datasets[args.index].data.reduce(function(a,b){ return a + Number(b||0); }, 0);
      var cur = -Math.PI/2;
      meta.data.forEach(function(arc, i){
        var value = chart.data.datasets[args.index].data[i];
        var frac = total > 0 ? (value/total) : 0;
        var span = frac * available;
        arc.startAngle = cur + gap/2;
        arc.endAngle = cur + span + gap/2;
        arc.circumference = span;
        cur += span + gap;
      });
    }
  };

  function makeDonutTooltip(container, getIsDark, getMode){
    var state = { x:0, y:0, raf:null };
    function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
    function lerp(a, b, t){ return a + (b-a)*t; }
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = container.querySelector(".up-donut-tt");
      var dark = !!getIsDark();
      if (!el){
        el = document.createElement("div");
        el.className = "up-donut-tt";
        el.style.cssText = "position:absolute;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease, transform 120ms ease;";
        el.innerHTML = '<div class="up-tt-box"><div class="up-tt-title"><span class="up-tt-dot"></span><span class="up-tt-lbl"></span></div><div class="up-tt-sub">Share:</div><div class="up-tt-val"></div></div>';
        chart.canvas.parentNode.appendChild(el);
      }
      /* Re-applied on every call, not just at creation: styling it once left the tooltip stuck on
         whatever theme happened to be active the first time it was ever shown. */
      var boxBg = dark ? "#121212" : "#ffffff";
      var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
      var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      var mutedColor = dark ? "#8a8a8a" : "#6f737c";
      el.querySelector(".up-tt-box").style.cssText = "background:" + boxBg + ";color:" + textColor + ";" + boxBorder + "border-radius:16px;padding:12px 14px;font-family:Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;line-height:1.35;" + boxShadow + "white-space:nowrap;";
      el.querySelector(".up-tt-title").style.cssText = "display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:6px;";
      el.querySelector(".up-tt-sub").style.cssText = "color:" + mutedColor + ";font-size:11px;";
      el.querySelector(".up-tt-val").style.cssText = "color:" + textColor + ";";
      if (tooltip.opacity === 0){ el.style.opacity = "0"; return; }
      var i = (tooltip.dataPoints && tooltip.dataPoints[0] && tooltip.dataPoints[0].dataIndex) || 0;
      var od = chart.data.datasets[0].originalData;
      var val = (od && od[i] != null) ? od[i] : (chart.data.datasets[0].data[i] || 0);
      var sliceColor = (chart.data.datasets[0].backgroundColor && chart.data.datasets[0].backgroundColor[i]) || textColor;
      /* The dot mirrors what's actually painted on the ring right now (dimmed grey included — it's
         a legend swatch, "this is this slice's current colour"). The NAME stays legible even while
         dimmed, so it reads off __realColors instead — a hovered, filtered-out slice's name should
         never itself look greyed out just because the ring paint is. */
      var realColors = chart.data.datasets[0].__realColors;
      var nameColor = (realColors && realColors[i]) || sliceColor;
      var isUrlMode = getMode && getMode() === "url";
      el.querySelector(".up-tt-dot").style.cssText = isUrlMode
        ? "width:6px;height:6px;border-radius:999px;flex:0 0 auto;background:" + sliceColor + ";display:inline-block;"
        : "display:none;";
      el.querySelector(".up-tt-lbl").style.color = nameColor;
      el.querySelector(".up-tt-lbl").textContent = chart.data.labels[i] || "";
      el.querySelector(".up-tt-val").textContent = Number(val).toFixed(2) + "%";
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + tooltip.caretX, caretY = cy + tooltip.caretY, m = 12;
      el.style.left = "0px"; el.style.top = "0px";
      var rect = el.getBoundingClientRect();
      var tx = (caretX + rect.width + m > cx + ca.right) ? (caretX - rect.width - m) : (caretX + m);
      tx = clamp(tx, cx + ca.left + m, cx + ca.right - rect.width - m);
      var ty = caretY - rect.height - m;
      if (ty < cy + ca.top + m) ty = caretY + m;
      ty = clamp(ty, cy + ca.top + m, cy + ca.bottom - rect.height - m);
      if (state.raf) cancelAnimationFrame(state.raf);
      var sx = state.x || tx, sy = state.y || ty, st = performance.now(), d = 120;
      function stepFn(now){
        var t = Math.min(1, (now-st)/d), k = t < .5 ? 2*t*t : -1 + (4-2*t)*t;
        var nx = lerp(sx, tx, k), ny = lerp(sy, ty, k);
        el.style.transform = "translate3d(" + nx + "px," + ny + "px,0)"; el.style.opacity = "1";
        state.x = nx; state.y = ny;
        if (t < 1) state.raf = requestAnimationFrame(stepFn);
      }
      state.raf = requestAnimationFrame(stepFn);
    };
  }

  function donutSkeletonHtml(){
    var rows = [[110,34],[72,22],[90,22],[120,18],[80,18]];
    var legend = rows.map(function(r){
      return '<div class="up-sk-row"><span class="up-sk-dot"></span><span class="up-sk-lbl" style="width:' + r[0] + 'px"></span><span class="up-sk-pct" style="width:' + r[1] + 'px"></span></div>';
    }).join("");
    /* unique ids per call — fixed ids collide when two instances share a page and the mask
       silently fails, painting an unmasked grey box on every instance but the first */
    var u = Math.random().toString(36).slice(2);
    var mId = "up-sk-mask-" + u, gId = "up-sk-grad-" + u;
    return '<div class="up-donut-sk">' +
      '<div class="up-sk-chart"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><mask id="' + mId + '"><circle cx="50" cy="50" r="38" fill="none" stroke="white" stroke-width="7"/></mask>' +
        '<linearGradient id="' + gId + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="up-sk-g0"/><stop offset="50%" class="up-sk-g1"/><stop offset="100%" class="up-sk-g0"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="38" fill="none" class="up-sk-ring" stroke-width="7"/>' +
        '<rect x="-60" y="0" width="50" height="100" fill="url(#' + gId + ')" mask="url(#' + mId + ')"><animateTransform attributeName="transform" type="translate" from="-60 0" to="160 0" dur="1.2s" repeatCount="indefinite"/></rect>' +
      '</svg></div>' +
      '<div class="up-sk-legend">' + legend + '</div>' +
    '</div>';
  }

  /* ---------- makeTypeChart ----------
     One controller for both the doughnut and the bar view of the same [{name, share, color}] data,
     because a component always has both behind one switcher.
     cfg: { body, isDark(), isOwner(), mode(), total(), centerLabel, collapseAt, availHeight() }
     Returns { renderDonut, renderBars, skeleton, empty, destroy, applyCollapse, resize, chart }. */
  function makeTypeChart(cfg){
    var body = cfg.body;
    var isDark = cfg.isDark || function(){ return false; };
    var isOwner = cfg.isOwner || function(){ return true; };
    var total = cfg.total || function(){ return 0; };
    var collapseAt = cfg.collapseAt != null ? cfg.collapseAt : 420;
    var chart = null;
    var donutTooltip = makeDonutTooltip(body, isDark, cfg.mode);
    /* Tracks what the LAST full render actually drew, so updateColors() (a dim-only re-colour, see
       below) can tell "same slices/bars, just different selection" from "genuinely new data" —
       only the former is safe to patch in place. */
    var lastKeys = null, lastMode = null;
    function keysOf(d){ return (d || []).map(function(it){ return it.key; }).join(""); }

    function destroy(){
      if (chart){ try { chart.destroy(); } catch(e){} chart = null; }
      var cv = body.querySelector("canvas");
      if (cv && window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(cv); if (ex) try { ex.destroy(); } catch(e){} }
    }
    /* below collapseAt the legend drops under the doughnut instead of sitting beside it */
    function applyCollapse(){
      var layout = body.querySelector(".up-donut-layout");
      if (!layout) return;
      var host = cfg.collapseHost || body;
      layout.classList.toggle("is-collapsed", host.getBoundingClientRect().width < collapseAt);
    }
    function skeleton(){ destroy(); body.innerHTML = donutSkeletonHtml(); }
    function empty(msg){ destroy(); body.innerHTML = '<div class="up-chart-empty">' + esc(msg || "No data") + '</div>'; }
    function isEmpty(d){ return !d.length || d.every(function(x){ return !(Number(x.share) > 0); }); }

    function renderDonut(d){
      if (!isOwner()) return;
      destroy();
      d = d || [];
      lastKeys = keysOf(d); lastMode = "donut";
      if (isEmpty(d)){ empty(); return; }
      body.innerHTML =
        '<div class="up-donut-layout">' +
          '<div class="up-donut-wrap"><canvas></canvas>' +
            '<div class="up-donut-center"><span class="n">' + esc(fmtTotal(total())) + '</span><span class="lbl">' + esc(cfg.centerLabel || "Citations") + '</span></div>' +
          '</div><div class="up-donut-legend"></div>' +
        '</div>';
      var clickable = !!cfg.onSliceClick;
      body.querySelector(".up-donut-legend").innerHTML = d.map(function(it){
        return '<div class="up-donut-legend-row' + (clickable && it.key !== "other" ? " is-clickable" : "") + '" data-type-key="' + esc(it.key || "") + '"><span class="up-donut-legend-chip" style="background:' + it.color + '"></span>' +
          '<span class="up-donut-legend-name">' + esc(it.name) + '</span>' +
          '<span class="up-donut-legend-pct">' + esc(fmtPct(it.share)) + '</span></div>';
      }).join("");
      if (clickable){
        Array.prototype.forEach.call(body.querySelectorAll(".up-donut-legend-row.is-clickable"), function(row){
          row.addEventListener("click", function(){ cfg.onSliceClick(row.getAttribute("data-type-key")); });
        });
      }
      applyCollapse();
      loadChartJs().then(function(){
        if (!isOwner()) return;
        var canvas = body.querySelector("canvas");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var origData = d.map(function(x){ return x.share; });
        /* floor the drawn value so a near-zero slice still gets a visible sliver; the tooltip
           reads originalData so the number stays truthful */
        var display = origData.map(function(v){ return Math.max(v, 1.0); });
        var allZero = origData.every(function(v){ return v <= 0; });
        window.Chart.defaults.color = isDark() ? "#a0a0a0" : "#6f737c";
        window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
        try {
          chart = new window.Chart(ctx, {
            type: "doughnut",
            data: { labels: allZero ? ["—"] : d.map(function(x){ return x.name; }),
              datasets: [{ data: allZero ? [1] : display, originalData: allZero ? [0] : origData,
                backgroundColor: allZero ? [isDark() ? "rgba(255,255,255,0.06)" : "#eeeeee"] : d.map(function(x){ return x.color; }),
                /* Darken a dimmed (filtered-out) slice on hover instead of brightening it — it's
                   already a light neutral grey, so brightening read as "this slice turns nearly
                   white," not "this slice is being hovered." Real-colour slices still brighten. */
                hoverBackgroundColor: allZero ? [isDark() ? "rgba(255,255,255,0.06)" : "#eeeeee"] : d.map(function(x){ return x.__dimmed ? darken(x.color, 0.08) : brighten(x.color, 0.15); }),
                __realColors: allZero ? [] : d.map(function(x){ return x.__realColor || x.color; }),
                spacing: 0, borderWidth: 0, borderRadius: CORNER, hoverOffset: HOVER }] },
            plugins: [constantGapPlugin, ringWidthPlugin],
            options: { responsive: true, maintainAspectRatio: false, layout: { padding: 8 },
              animation: { duration: 200, easing: "easeOutQuad" },
              plugins: { legend: { display:false }, tooltip: { enabled:false, external: donutTooltip } },
              onClick: (clickable && !allZero) ? function(evt, elements){
                if (!elements || !elements.length) return;
                var it = d[elements[0].index];
                if (it && it.key && it.key !== "other") cfg.onSliceClick(it.key);
              } : undefined,
              onHover: (clickable && !allZero) ? function(evt, elements){
                evt.native.target.style.cursor = (elements && elements.length) ? "pointer" : "default";
              } : undefined }
          });
        } catch(err){}
      })["catch"](function(){});
    }

    function renderBars(d){
      if (!isOwner()) return;
      destroy();
      d = (d || []).slice().sort(function(a, b){ return b.share - a.share; });
      if (isEmpty(d)){ empty(); return; }
      lastKeys = keysOf(d); lastMode = "bar";
      body.innerHTML = '<div class="up-bars">' + d.map(function(it){
        /* Label colour follows the fill's luminance so it stays readable: white on dark/mid fills,
           dark on genuinely light ones. Bar colours are identical in both themes, so this is
           per-bar, not per-theme. */
        var light = barIsLight(it.color);
        var txt = light ? "rgba(31,31,27,0.96)" : "rgba(255,255,255,0.95)";
        var txtPct = light ? "rgba(31,31,27,0.62)" : "rgba(255,255,255,0.75)";
        var outColor = isDark() ? "rgba(255,255,255,0.85)" : "var(--vc-text)";
        var outPctColor = isDark() ? "rgba(255,255,255,0.55)" : "var(--vc-muted)";
        return '<div class="up-bar-row' + (cfg.onSliceClick && it.key !== "other" ? " is-clickable" : "") + (it.__dimmed ? " is-dimmed" : "") + '" data-type-key="' + esc(it.key || "") + '"><div class="up-bar-track">' +
            '<div class="up-bar-fill" style="background:' + it.color + ';width:0%">' +
              '<span class="up-bar-name" style="color:' + txt + ';opacity:0">' + esc(it.name) + '</span>' +
              '<span class="up-bar-pct up-bar-pct-in" style="color:' + txtPct + ';opacity:0">' + esc(fmtPct(it.share)) + '</span>' +
            '</div>' +
            '<span class="up-bar-outside" style="opacity:0">' +
              '<span class="up-bar-name-out" style="color:' + outColor + '">' + esc(it.name) + '</span>' +
              '<span class="up-bar-pct-out" style="color:' + outPctColor + '">' + esc(fmtPct(it.share)) + '</span>' +
            '</span></div></div>';
      }).join("") + '</div>';

      var rows = Array.prototype.slice.call(body.querySelectorAll(".up-bar-row"));
      if (cfg.onSliceClick){
        rows.forEach(function(row){
          if (!row.classList.contains("is-clickable")) return;
          row.addEventListener("click", function(){ cfg.onSliceClick(row.getAttribute("data-type-key")); });
        });
      }
      var metrics = rows.map(function(row){
        return { nameW: measureText(row.querySelector(".up-bar-name")), pctW: measureText(row.querySelector(".up-bar-pct-in")) };
      });
      /* labels sit inside the bar when it's wide enough, otherwise they move outside next to it */
      function placeRow(row, m){
        var fill = row.querySelector(".up-bar-fill"), name = row.querySelector(".up-bar-name"),
            pin = row.querySelector(".up-bar-pct-in"), outside = row.querySelector(".up-bar-outside");
        if (!fill || !outside) return;
        var fillPx = fill.offsetWidth, needed = m.nameW + m.pctW + 12 + 20;
        if (fillPx >= needed){ if (name) name.style.opacity = "1"; if (pin) pin.style.opacity = "1"; outside.style.opacity = "0"; }
        else { if (name) name.style.opacity = "0"; if (pin) pin.style.opacity = "0"; outside.style.left = Math.round(fillPx + 8) + "px"; outside.style.opacity = "1"; }
      }
      function placeAll(){ rows.forEach(function(row, i){ placeRow(row, metrics[i]); }); }
      function fitBars(){
        if (!rows.length) return;
        var avail = cfg.availHeight ? cfg.availHeight() : body.clientHeight;
        if (!avail || avail <= 0) return;
        var rowH = rows[0].offsetHeight || 42;
        var maxVisible = Math.max(1, Math.floor(avail / rowH));
        for (var i = 0; i < rows.length; i++) rows[i].style.display = (i < maxVisible) ? "" : "none";
      }
      /* double rAF so the 0% width lands in a painted frame first — otherwise the browser
         coalesces both widths and the grow animation never runs */
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        rows.forEach(function(row, i){ var fill = row.querySelector(".up-bar-fill"); if (fill) fill.style.width = Math.max(d[i].share, 0) + "%"; });
        fitBars();
      }); });
      var placed = false;
      rows.forEach(function(row){
        var fill = row.querySelector(".up-bar-fill"); if (!fill) return;
        var done = false;
        fill.addEventListener("transitionend", function onEnd(e){
          if (e.propertyName !== "width" || done) return;
          done = true; fill.removeEventListener("transitionend", onEnd);
          var i = rows.indexOf(row); if (i >= 0) placeRow(row, metrics[i]);
        });
      });
      setTimeout(function(){ placed = true; fitBars(); placeAll(); }, 640);
      if (window.ResizeObserver){
        var ro = new ResizeObserver(function(){ fitBars(); if (placed) placeAll(); });
        ro.observe(body);
        rows.forEach(function(row){ var t = row.querySelector(".up-bar-track"); if (t) ro.observe(t); });
      }
    }

    /* Re-colours an already-rendered donut/bars in place — no destroy, no replayed entrance
       animation, no DOM node replacement — for when only WHICH items are dimmed changed (a type-
       filter toggle), not the underlying data. A full renderDonut()/renderBars() call replays the
       entrance animation every time it runs (donut: a fresh 200ms fade-in; bars: width resets to
       0% and regrows, core.css .up-bar-fill transition) — correct for genuinely new data, but on
       every single filter click it read as the whole chart flashing/highlighting before settling.
       Falls back to a full render if the item SET actually changed (different keys or order, not
       just which of the same items are selected) — updateColors only ever patches, never adds or
       removes bars/slices. */
    function updateColors(d){
      d = d || [];
      var normalized = (lastMode === "bar") ? d.slice().sort(function(a, b){ return b.share - a.share; }) : d;
      if (keysOf(normalized) !== lastKeys){
        if (lastMode === "bar") renderBars(d); else renderDonut(d);
        return;
      }
      if (lastMode === "bar"){
        var rows = Array.prototype.slice.call(body.querySelectorAll(".up-bar-row"));
        rows.forEach(function(row, i){
          var it = normalized[i]; if (!it) return;
          var fill = row.querySelector(".up-bar-fill");
          if (fill) fill.style.background = it.color;
          row.classList.toggle("is-dimmed", !!it.__dimmed);
        });
      } else if (chart){
        chart.data.datasets[0].backgroundColor = normalized.map(function(x){ return x.color; });
        chart.data.datasets[0].hoverBackgroundColor = normalized.map(function(x){ return x.__dimmed ? darken(x.color, 0.08) : brighten(x.color, 0.15); });
        chart.data.datasets[0].__realColors = normalized.map(function(x){ return x.__realColor || x.color; });
        chart.update("none");
      }
    }

    return {
      renderDonut: renderDonut,
      renderBars: renderBars,
      updateColors: updateColors,
      skeleton: skeleton,
      empty: empty,
      destroy: destroy,
      applyCollapse: applyCollapse,
      resize: function(){ try { if (chart) chart.resize(); } catch(e){} },
      chart: function(){ return chart; }
    };
  }

  /* Suppresses :hover-driven repaints on table rows while the page is actively scrolling — one
     page-global listener, install-once like the tooltip's own scroll listener above, so it works
     no matter how many components/roots share the page (and however many times core.js itself
     gets re-evaluated by them).
     Content sliding under a stationary cursor still fires real mouseenter/mouseleave in every
     browser, and .up-row:hover changes `background`, a paint-triggering property, not a cheap
     compositor-only one (transform/opacity) — with the cursor parked over a tall table during a
     scroll that's a full-width paint on every row that crosses it, which is what "scrolling isn't
     smooth" actually was. pointer-events:none on the tbody during a scroll (removed ~150ms after
     the last scroll event) blocks hover-matching entirely for the duration, taking every
     hover-driven style with it (row background, chip hover, the goto arrow) without having to
     enumerate and override each one — and without touching click handling, since a genuine row
     click can't land mid-scroll anyway. */
  if (!window.__upScrollHoverBound){
    window.__upScrollHoverBound = true;
    var scrollHoverRaf = null, scrollHoverSettle = null;
    window.addEventListener("scroll", function(){
      if (!scrollHoverRaf){
        scrollHoverRaf = requestAnimationFrame(function(){
          scrollHoverRaf = null;
          document.documentElement.classList.add("up-is-scrolling");
        });
      }
      clearTimeout(scrollHoverSettle);
      scrollHoverSettle = setTimeout(function(){
        document.documentElement.classList.remove("up-is-scrolling");
      }, 150);
    }, { capture: true, passive: true });
  }

  window.UpstreemCore = {
    CITE_COLOR: CITE_COLOR,
    CITE_ALIAS: CITE_ALIAS,
    ALL_CITATION_TYPES: ALL_CITATION_TYPES,
    URL_TYPE: URL_TYPE,
    ALL_URL_TYPES: ALL_URL_TYPES,
    OTHER_LIGHT: OTHER_LIGHT,
    OTHER_DARK: OTHER_DARK,
    CHIP_BG_DARK: CHIP_BG_DARK,
    MONTHS: MONTHS,
    DEBOUNCE: DEBOUNCE,
    MIN: MIN,
    SORT_DEBOUNCE: SORT_DEBOUNCE,
    PAGE_SIZES: PAGE_SIZES,
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    fmtTotal: fmtTotal,
    isYes: isYes,
    highlight: highlight,
    redditTitleHtml: redditTitleHtml,
    esc: esc,
    parseBubbleJson: parseBubbleJson,
    citeName: citeName,
    tint: tint,
    brighten: brighten,
    darken: darken,
    toNum: toNum,
    fmt1: fmt1,
    fmtInt: fmtInt,
    fmtDate: fmtDate,
    foldDiacritics: foldDiacritics,
    germanExpand: germanExpand,
    resolveBubbleFn: resolveBubbleFn,
    TREND_UP: TREND_UP,
    TREND_DOWN: TREND_DOWN,
    CHECK_SVG: CHECK_SVG,
    COPY_SVG: COPY_SVG,
    GOTO_SVG: GOTO_SVG,
    HASH_ICON: HASH_ICON,
    DONE_SVG: DONE_SVG,
    EXT_SVG: EXT_SVG,

    /* ---- table primitives ---- */
    trendChip: trendChip,
    sentColor: sentColor,
    brandStack: brandStack,
    skeletonRows: skeletonRows,
    makeColumns: makeColumns,
    makeSearch: makeSearch,
    bootStubs: bootStubs,
    makeMount: makeMount,
    makePager: makePager,
    makeHeadSort: makeHeadSort,
    makeSoftReload: makeSoftReload,
    legacyCopy: legacyCopy,
    makeEmptyGrace: makeEmptyGrace,
    makeExplain: makeExplain,
    STORE: STORE,
    LOADING_EXPLICIT: LOADING_EXPLICIT,
    makeTooltips: makeTooltips,
    makeFire: makeFire,
    makePortal: makePortal,
    placeMenu: placeMenu,
    makePopover: makePopover,
    closePopovers: closeAll,
    makeSticky: makeSticky,
    rafThrottle: rafThrottle,
    unclipAncestors: unclipAncestors,
    watchRoots: watchRoots,
    TOPIC_COLOR_PALETTE: TOPIC_COLOR_PALETTE,
    swatchInk: swatchInk,
    ensureEmojiLib: ensureEmojiLib,
    makeTopicModal: makeTopicModal,

    /* ---- chart kits (see the big comment block above) ---- */
    loadChartJs: loadChartJs,
    CITE_COLOR_DARK: CITE_COLOR_DARK,
    URL_LABEL: URL_LABEL,
    URL_COLOR_CHART: URL_COLOR_CHART,
    URL_COLOR_DARK: URL_COLOR_DARK,
    CHART_OTHER_LIGHT: CHART_OTHER_LIGHT,
    CHART_OTHER_DARK: CHART_OTHER_DARK,
    MAX_URL_SLICES: MAX_URL_SLICES,
    typeColor: typeColor,
    prepTypeData: prepTypeData,
    applyTypeDim: applyTypeDim,
    barIsLight: barIsLight,
    measureText: measureText,
    fmtPct: fmtPct,
    capitalize: capitalize,
    truncate: truncate,
    chartDateFmt: chartDateFmt,
    chartDateTitle: chartDateTitle,
    getPageWidth: getPageWidth,
    injectWatermark: injectWatermark,
    makeLine: makeLine,
    makeTypeChart: makeTypeChart,
    getLineWidthPref: getLineWidthPref,
    setLineWidthPref: setLineWidthPref,
    lineWidthSectionHtml: lineWidthSectionHtml
  };
})();
