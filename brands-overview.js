/* upstreem brands-overview.js — component logic. Requires core.js (window.UpstreemCore) first.

   Standalone page component: a chart container on top (Line chart — the same one visibility-chart
   draws, from the same RPC — or the new "Landscape" matrix), and below it a brands table with its
   own toolbar, an Active/Inactive switcher and a per-row actions menu.

   What is deliberately NOT re-implemented here (it all comes from core):
     line chart + legend + tooltip + skeleton     UC.makeLine
     series -> datasets, colour scales            UC.buildLineDatasets / UC.COLOR_SCALES
     the gear "Chart Settings" dropdown           UC.makeScaleMenu
     dropdown open/close/outside-click/Escape     UC.makePopover
     button tooltips                              UC.makeTooltips
     search slide-out + debounce + requestId      UC.makeSearch
     column explainers                            UC.makeExplain
     Bubble plumbing (registry, stub replay, …)   UC.makeMount
     cell primitives (.up-num/.up-sent/…)         UC.trendChip / UC.sentColor / UC.fmt1

   What genuinely IS local, and why: the Landscape matrix chart and the row actions menu each have
   exactly ONE consumer today. STYLEGUIDE §25 says build local first and extract on the SECOND
   consumer — extracting now would be guessing at an interface nothing else has asked for yet. */
(function(){
  "use strict";

  /* Stubs before anything can wait on core.js: Bubble polls these by name and would otherwise
     lose the earliest calls (same reasoning as every other component here). */
  var __uboBootQueue = window.__uboBootQueue = window.__uboBootQueue || [];
  if (!window.__uboBootStubbed){
    window.__uboBootStubbed = true;
    ["renderBrandsOverview", "setBrandsOverviewLoading", "resetBrandsOverview",
     "setBrandsOverviewInactive", "setBrandsOverviewTheme"].forEach(function(n){
      window[n] = function(){ __uboBootQueue.push([n, arguments]); };
    });
  }

  function uboBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uboBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uboRun();
  }

  function uboRun(){
  var UC = window.UpstreemCore;

  /* core.js is ONE global shared by every component on the page, but each component loads it via
     its own data-cdn-pin — so a page with mixed pins keeps whichever core.js executed last. If
     that one predates a kit this file needs, the component used to die on the first call to it
     with a bare "UC.<kit> is not a function", which says nothing about the actual cause. Name the
     cause once, then degrade: the gear menu becomes a no-op and the line chart stays empty, but
     the table, the Landscape chart and every event still work. */
  var MISSING = ["makeMount", "makeLine", "makePopover", "makeSearch", "makeColumns",
                 "makeTooltips", "buildLineDatasets", "makeScaleMenu"]
    .filter(function(k){ return typeof UC[k] !== "function"; });
  if (MISSING.length && window.console){
    console.error("[brands-overview] The core.js running on this page is OLDER than " +
      "brands-overview.js and is missing: " + MISSING.join(", ") + ". Every Upstreem component on " +
      "a page shares one core.js — the last one loaded wins — so pin them ALL to the same commit " +
      "(data-cdn-pin). Degrading: chart settings and the line chart are disabled.");
  }
  if (typeof UC.makeScaleMenu !== "function"){
    UC.makeScaleMenu = function(){
      return { open: function(){}, close: function(){}, isOpen: function(){ return false; },
               populate: function(){}, reposition: function(){} };
    };
  }
  if (typeof UC.buildLineDatasets !== "function"){
    UC.buildLineDatasets = function(){ return { labels: [], datasets: [] }; };
  }

  var esc = UC.esc, isYes = UC.isYes, fmt1 = UC.fmt1, sentColor = UC.sentColor;
  var CHECK_SVG = UC.CHECK_SVG;

  /* ================================================================
     Landscape (matrix) chart — visibility on X, sentiment on Y, one logo per brand.
     Local by §25 (single consumer). Everything that CAN come from core does: Chart.js loading,
     the sentiment colour ramp, the app's escape/outside-click idioms.
     Differences from the standalone prototype this replaces, all deliberate:
       · colours are read from the live CSS custom properties instead of a hardcoded THEME blob,
         so light/dark follows the app automatically with no second palette to keep in sync
       · the Y axis is the app's real 0–100 sentiment scale (the prototype squeezed it to 0–1 and
         printed "0.5"), so the number under the cursor matches the number in the table
       · logo chips use the app's chip geometry (32px box, 8px radius, 2px pad, 6px inner radius)
     ================================================================ */
  /* core's real hash icon, so the rank in the Landscape tooltip is literally the same mark the
     tables draw — the old tooltip used a typed "#" character, which is why it looked off. */
  var HASH_SVG = UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ');
  var MX = {
    logoSize: 32, logoRadius: 8, logoInnerRadius: 6, logoPad: 2,
    logoMinGap: 4, hoverScale: 1.08, hitRadius: 22,
    relaxIters: 22, relaxPull: 0.10, maxSpiral: 140,
    xTicks: 6, yTicks: 6, yMin: 0, yMax: 100, midY: 50,
    padTop: 16, padRight: 16, animMs: 400
  };
  /* Deterministic pseudo-random from a stable id — the collision solver needs to break exact ties
     and pick spiral start angles WITHOUT Math.random(), or logos would jump to a different spot on
     every single redraw (theme toggle, resize, filter change). */
  function hash01(str){
    str = String(str || "");
    var h = 2166136261;
    for (var i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967295;
  }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function rrect(ctx, x, y, w, h, r){
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);     ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);     ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x, y + r);         ctx.arcTo(x,     y,     x + r, y,          r);
    ctx.closePath();
  }
  var _mxImgs = {};
  function mxImg(url, onload){
    if (!url) return null;
    if (_mxImgs[url]) return _mxImgs[url];
    var img = new Image();
    img.src = url;
    /* Redraw only — never chart.update() — when a logo finishes loading: update() re-runs layout,
       which would re-run the collision solver and make every other logo twitch. */
    img.onload = function(){ if (onload) onload(); };
    _mxImgs[url] = img;
    return img;
  }
  function mxPx(chart, pt){
    if (pt && pt._px != null && pt._py != null) return { px: pt._px, py: pt._py };
    return { px: chart.scales.x.getPixelForValue(pt.x), py: chart.scales.y.getPixelForValue(pt.y) };
  }

  /* makeMatrix(cfg) — cfg: { wrap, canvas, isDark(), isOwner(), onPick(company_id) }
     Returns { render(rows), skeleton(), destroy(), resize() }. */
  function makeMatrix(cfg){
    /* Y axis is switchable: "sentiment" (0-100, higher is better) or "ranking" (avg_rank, where
       LOWER is better, so that axis is drawn inverted and the quadrant split sits at the midpoint
       of the actual rank range rather than at a fixed 50). X (visibility) is the same either way. */
    function yMode(){ return cfg.getYAxis && cfg.getYAxis() === "ranking" ? "ranking" : "sentiment"; }
    var midYVal = MX.midY;
    var wrap = cfg.wrap, canvas = cfg.canvas;
    var isDark = cfg.isDark || function(){ return false; };
    var isOwner = cfg.isOwner || function(){ return true; };
    var chart = null, points = [], hovered = null, lastRows = null, tipEl = null, tipRaf = null;
    var tipX = 0, tipY = 0;

    /* One source of truth for colour: the same CSS custom properties every other component reads,
       resolved live so a theme flip needs no second palette here. */
    function tok(name, fallback){
      try {
        var v = getComputedStyle(wrap).getPropertyValue(name);
        v = (v || "").trim();
        return v || fallback;
      } catch(e){ return fallback; }
    }
    function theme(){
      var dark = isDark();
      return {
        grid:    tok("--vc-border", dark ? "#454545" : "#e0e2e6"),
        gridSoft: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        font:    tok("--vc-muted",  dark ? "#a0a0a0" : "#6f737c"),
        axis:    tok("--vc-border", dark ? "#454545" : "#e0e2e6"),
        quad:    tok("--vc-border", dark ? "#454545" : "#e0e2e6"),
        quadTxt: tok("--vc-third",  dark ? "#808080" : "#9e9e9e"),
        logoBg:  tok("--vt-logo-bg", "#ffffff"),
        logoBd:  tok("--vc-border", dark ? "#454545" : "#e0e2e6")
      };
    }

    function gridPlugin(){
      return {
        id: "uboMxGrid",
        beforeDatasetsDraw: function(c){
          var t = theme(), A = c.chartArea, x = c.scales.x, y = c.scales.y, ctx = c.ctx;
          if (!A || !x || !y) return;
          ctx.save();
          ctx.beginPath(); ctx.rect(A.left, A.top, A.right - A.left, A.bottom - A.top); ctx.clip();
          /* 1px, and deliberately LIGHTER than the solid quadrant lines below: this grid used the
             full --vc-border colour, i.e. exactly the weight of the quadrant split, so the two
             read as one heavy mesh. core's line chart draws its dashed grid at ~0.08 alpha; this
             matches that relationship. */
          ctx.strokeStyle = t.gridSoft; ctx.lineWidth = 1; ctx.setLineDash([6, 6]);
          y.ticks.forEach(function(_, i){
            var py = y.getPixelForTick(i);
            ctx.beginPath(); ctx.moveTo(A.left, py + 0.5); ctx.lineTo(A.right, py + 0.5); ctx.stroke();
          });
          x.ticks.forEach(function(_, i){
            var px = x.getPixelForTick(i);
            ctx.beginPath(); ctx.moveTo(px + 0.5, A.top); ctx.lineTo(px + 0.5, A.bottom); ctx.stroke();
          });
          ctx.restore();
        }
      };
    }
    function quadrantPlugin(){
      return {
        id: "uboMxQuad",
        beforeDatasetsDraw: function(c){
          var t = theme(), A = c.chartArea, ctx = c.ctx;
          var midX = (c.scales.x.min + c.scales.x.max) / 2;
          var mx = c.scales.x.getPixelForValue(midX);
          var my = c.scales.y.getPixelForValue(midYVal);
          var p = 14;
          ctx.save();
          ctx.strokeStyle = t.quad; ctx.lineWidth = 1; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(mx, A.top);  ctx.lineTo(mx, A.bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(A.left, my); ctx.lineTo(A.right, my);  ctx.stroke();
          ctx.fillStyle = t.quadTxt;
          ctx.font = '500 11px Geist, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
          /* The quadrant names describe SENTIMENT on Y ("Controversial" = seen a lot, liked
             little). With Ranking on Y that reading is simply wrong, so the four labels follow
             the axis instead of staying put and lying. */
             var Q = (yMode() === "ranking")
               ? ["Rising Challengers", "Category Leaders", "Low Presence", "Broad but Unranked"]
               : ["High-Potential Players", "Dominant & Trusted", "At Risk", "Controversial"];
          ctx.textAlign = "left";  ctx.textBaseline = "top";    ctx.fillText(Q[0], A.left  + p, A.top    + p);
          ctx.textAlign = "right"; ctx.textBaseline = "top";    ctx.fillText(Q[1], A.right - p, A.top    + p);
          ctx.textAlign = "left";  ctx.textBaseline = "bottom"; ctx.fillText(Q[2], A.left  + p, A.bottom - p);
          ctx.textAlign = "right"; ctx.textBaseline = "bottom"; ctx.fillText(Q[3], A.right - p, A.bottom - p);
          ctx.restore();
        }
      };
    }
    /* Collision solver: relaxation (repel + pull back toward the true position), then a
       deterministic spiral placement for anything still overlapping. Stable across redraws
       because every "random" input is hashed from the company id. */
    function layoutPlugin(){
      return {
        id: "uboMxLayout",
        afterLayout: function(c){
          var A = c.chartArea, xS = c.scales.x, yS = c.scales.y;
          if (!A || !xS || !yS) return;
          var nodes = points.map(function(pt){
            var x0 = xS.getPixelForValue(pt.x), y0 = yS.getPixelForValue(pt.y);
            return { pt: pt, id: pt.company_id, x0: x0, y0: y0,
                     x: x0 + (hash01("x:" + pt.company_id) - 0.5) * 1.2,
                     y: y0 + (hash01("y:" + pt.company_id) - 0.5) * 1.2 };
          });
          var N = nodes.length;
          if (!N) return;
          if (N === 1){ nodes[0].pt._px = nodes[0].x0; nodes[0].pt._py = nodes[0].y0; return; }

          var eff = MX.logoSize * Math.max(1, MX.hoverScale);
          var half = eff / 2, minD = eff + MX.logoMinGap;
          function clampNode(n){
            n.x = clamp(n.x, A.left + half, A.right - half);
            n.y = clamp(n.y, A.top + half, A.bottom - half);
          }
          function hits(ax, ay, bx, by){ return Math.abs(ax - bx) < minD && Math.abs(ay - by) < minD; }

          for (var k = 0; k < MX.relaxIters; k++){
            var fx = new Array(N), fy = new Array(N), i, j;
            for (i = 0; i < N; i++){ fx[i] = 0; fy[i] = 0; }
            for (i = 0; i < N; i++){
              for (j = i + 1; j < N; j++){
                var a = nodes[i], b = nodes[j];
                var dx = a.x - b.x, dy = a.y - b.y;
                var ox = minD - Math.abs(dx), oy = minD - Math.abs(dy);
                if (ox > 0 && oy > 0){
                  var vx = dx, vy = dy;
                  if (vx === 0 && vy === 0){
                    var ang = hash01("a:" + a.id + "|" + b.id) * Math.PI * 2;
                    vx = Math.cos(ang); vy = Math.sin(ang);
                  }
                  var len = Math.hypot(vx, vy) || 1;
                  vx /= len; vy /= len;
                  var push = Math.min(ox, oy) * 0.55 + 0.01;
                  fx[i] += vx * push; fy[i] += vy * push;
                  fx[j] -= vx * push; fy[j] -= vy * push;
                }
              }
            }
            for (i = 0; i < N; i++){
              var n = nodes[i];
              n.x += fx[i]; n.y += fy[i];
              n.x = lerp(n.x, n.x0, MX.relaxPull);
              n.y = lerp(n.y, n.y0, MX.relaxPull);
              clampNode(n);
            }
          }

          nodes.sort(function(p, q){ return (p.x0 - q.x0) || (p.y0 - q.y0) || (p.id < q.id ? -1 : 1); });
          var placed = [];
          function free(x, y){
            for (var i = 0; i < placed.length; i++){ if (hits(x, y, placed[i].x, placed[i].y)) return false; }
            return true;
          }
          nodes.forEach(function(n){
            if (!free(n.x, n.y)){
              var start = hash01("s:" + n.id) * Math.PI * 2, found = false;
              for (var r = 1.6; r <= MX.maxSpiral && !found; r += 1.6){
                for (var a = 0; a < Math.PI * 2 && !found; a += 0.55){
                  var cx = clamp(n.x + Math.cos(start + a) * r, A.left + half, A.right - half);
                  var cy = clamp(n.y + Math.sin(start + a) * r, A.top + half, A.bottom - half);
                  if (free(cx, cy)){ n.x = cx; n.y = cy; found = true; }
                }
              }
            }
            placed.push(n);
            n.pt._px = n.x; n.pt._py = n.y;
          });
        }
      };
    }
    function logoPlugin(){
      return {
        id: "uboMxLogos",
        afterDatasetsDraw: function(c){
          var ctx = c.ctx, t = theme(), base = MX.logoSize;
          ctx.save();
          points.forEach(function(pt){
            var P = mxPx(c, pt);
            var over = hovered && hovered.company_id === pt.company_id;
            var s = over ? base * MX.hoverScale : base;
            var f = s / base;
            var rx = P.px - s / 2, ry = P.py - s / 2;
            var pad = MX.logoPad * f, rOut = MX.logoRadius * f, rIn = MX.logoInnerRadius * f;

            /* Was 0.42/14/4 — a drop shadow that heavy exists nowhere else in this app. The app's
               floating layers sit around 0.10-0.16 alpha; a hovered chip should read as lifted,
               not as cut out of the chart. */
            if (over){ ctx.shadowColor = "rgba(0,0,0,0.14)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; }
            ctx.fillStyle = t.logoBg;
            rrect(ctx, rx, ry, s, s, rOut);
            ctx.fill();
            ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.strokeStyle = t.logoBd; ctx.lineWidth = 1;
            rrect(ctx, rx + 0.5, ry + 0.5, s - 1, s - 1, Math.max(0, rOut - 0.5));
            ctx.stroke();

            var img = pt.logo_url ? mxImg(pt.logo_url, function(){ if (chart) chart.draw(); }) : null;
            if (img && img.complete && img.naturalWidth > 0){
              ctx.save();
              rrect(ctx, rx + pad, ry + pad, s - pad * 2, s - pad * 2, rIn);
              ctx.clip();
              ctx.drawImage(img, rx + pad, ry + pad, s - pad * 2, s - pad * 2);
              ctx.restore();
            } else {
              ctx.fillStyle = t.font;
              ctx.font = '600 11px Geist, system-ui, Arial, sans-serif';
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText(String(pt.name || "?").charAt(0).toUpperCase(), P.px, P.py);
            }
          });
          ctx.restore();
        }
      };
    }

    /* Tooltip: body-mounted like every other floating layer in the app, styled by .ubo-mxtip in
       brands-overview.css (no inline style blob), and following the cursor with the same eased
       motion the line-chart tooltip uses. */
    function ensureTip(){
      if (tipEl && document.body.contains(tipEl)) return tipEl;
      tipEl = document.createElement("div");
      tipEl.className = "ubo-mxtip";
      document.body.appendChild(tipEl);
      return tipEl;
    }
    function hideTip(){ if (tipEl) tipEl.classList.remove("is-on"); }
    function killTip(){
      if (tipRaf){ cancelAnimationFrame(tipRaf); tipRaf = null; }
      if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
      tipEl = null; tipX = 0; tipY = 0;
    }
    function showTip(pt){
      if (!pt){ hideTip(); return; }
      var el = ensureTip();
      el.setAttribute("data-theme", isDark() ? "dark" : "light");
      var vis  = pt.x != null ? UC.fmtPct(pt.x) : "–";
      var sv   = pt.sentiment, rv = pt.avg_rank;
      var sentHtml = (sv == null) ? '<span class="ubo-mxtip-empty">–</span>'
        : '<span class="up-sent"><span class="up-sent-dot" style="background:' + sentColor(sv) + '"></span>' +
          '<span class="up-sent-val">' + Math.round(sv) + '</span></span>';
      var rankHtml = (rv == null) ? '<span class="ubo-mxtip-empty">–</span>'
        : '<span class="up-rank-group">' + HASH_SVG + '<span class="up-num">' + fmt1(rv) + '</span></span>';
      el.innerHTML =
        '<div class="ubo-mxtip-head">' +
          '<span class="up-logo-box' + (pt.logo_url ? " has-img" : "") + '">' +
            (pt.logo_url ? '<img src="' + esc(pt.logo_url) + '" alt="" onerror="this.style.visibility=\'hidden\'"/>' : "") +
          '</span>' +
          '<span class="ubo-mxtip-name">' + esc(pt.name || "") + '</span>' +
        '</div>' +
        '<div class="ubo-mxtip-sep"></div>' +
        '<div class="ubo-mxtip-rows">' +
          '<div class="ubo-mxtip-row"><span class="ubo-mxtip-lbl">Visibility</span><span class="ubo-mxtip-val">' + vis + '</span></div>' +
          '<div class="ubo-mxtip-row"><span class="ubo-mxtip-lbl">Sentiment</span><span class="ubo-mxtip-val">' + sentHtml + '</span></div>' +
          '<div class="ubo-mxtip-row"><span class="ubo-mxtip-lbl">Avg. Rank</span><span class="ubo-mxtip-val">' + rankHtml + '</span></div>' +
        '</div>';
      el.style.left = "0"; el.style.top = "0";
      var tr = el.getBoundingClientRect(), cr = canvas.getBoundingClientRect(), m = 12;
      var P = mxPx(chart, pt);
      var px = cr.left + P.px, py = cr.top + P.py;
      var tx = px + m + MX.logoSize / 2;
      if (tx + tr.width + m > window.innerWidth) tx = px - tr.width - m - MX.logoSize / 2;
      tx = clamp(tx, m, window.innerWidth - tr.width - m);
      var ty = clamp(py - tr.height / 2, m, window.innerHeight - tr.height - m);
      if (tipRaf) cancelAnimationFrame(tipRaf);
      var sx = tipX || tx, sy = tipY || ty, st = performance.now(), dur = 120;
      (function step(now){
        var t = Math.min(1, (now - st) / dur);
        var k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        var cx = lerp(sx, tx, k), cy = lerp(sy, ty, k);
        el.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
        el.classList.add("is-on");
        tipX = cx; tipY = cy;
        if (t < 1) tipRaf = requestAnimationFrame(step);
      })(performance.now());
    }

    function hitTest(ev){
      if (!chart || !points.length) return null;
      var R = canvas.getBoundingClientRect();
      var mx = ev.clientX - R.left, my = ev.clientY - R.top, found = null;
      points.forEach(function(pt){
        var P = mxPx(chart, pt);
        var dx = mx - P.px, dy = my - P.py;
        if (Math.sqrt(dx * dx + dy * dy) <= MX.hitRadius) found = pt;
      });
      return found;
    }
    if (!canvas.__uboMxBound){
      canvas.__uboMxBound = true;
      var moveRaf = null;
      canvas.addEventListener("mousemove", function(ev){
        if (moveRaf) cancelAnimationFrame(moveRaf);
        moveRaf = requestAnimationFrame(function(){
          var f = hitTest(ev);
          if (f !== hovered){
            hovered = f;
            canvas.style.cursor = f ? "pointer" : "default";
            if (chart) chart.draw();     // draw, not update: update() would re-run the solver
            showTip(f);
          }
        });
      });
      canvas.addEventListener("mouseleave", function(){
        hovered = null;
        canvas.style.cursor = "default";
        if (chart) chart.draw();
        hideTip();
      });
      canvas.addEventListener("click", function(ev){
        var f = hitTest(ev);
        if (!f || f.company_id == null) return;
        hovered = null; canvas.style.cursor = "default";
        killTip();
        if (chart) chart.draw();
        if (cfg.onPick) cfg.onPick(String(f.company_id));
      });
    }

    function destroy(){
      if (chart){ try { chart.destroy(); } catch(e){} chart = null; }
      points = []; hovered = null;
      killTip();
    }
    function skeleton(){
      destroy();
      wrap.classList.add("is-sk");
    }
    function render(rows){
      if (!isOwner()) return;
      lastRows = rows;
      if (!window.Chart){ UC.loadChartJs(); setTimeout(function(){ render(lastRows); }, 120); return; }
      wrap.classList.remove("is-sk");
      var rank = (yMode() === "ranking");
      var yField = rank ? "avg_rank" : "sentiment";
      var pts = (rows || []).filter(function(r){
        return r && r.visibility_pct != null && r[yField] != null && isFinite(Number(r[yField]));
      }).map(function(r){
        return {
          x: Number(r.visibility_pct),
          y: rank ? Number(r.avg_rank) : clamp(Number(r.sentiment), MX.yMin, MX.yMax),
          sentiment: (r.sentiment != null && isFinite(Number(r.sentiment))) ? Number(r.sentiment) : null,
          avg_rank: (r.avg_rank != null && isFinite(Number(r.avg_rank))) ? Number(r.avg_rank) : null,
          name: r.name || "",
          logo_url: r.logo_url || r.favicon_url || "",
          company_id: r.company_id != null ? String(r.company_id) : String(r.name || "")
        };
      });
      pts.forEach(function(p){ if (p.logo_url) mxImg(p.logo_url, function(){ if (chart) chart.draw(); }); });
      points = pts;
      hovered = null;
      hideTip();

      var existing = window.Chart.getChart ? window.Chart.getChart(canvas) : null;
      if (existing) existing.destroy();
      if (!pts.length){ chart = null; wrap.classList.add("is-empty"); return; }
      wrap.classList.remove("is-empty");

      var t = theme();
      var maxVis = Math.max.apply(null, pts.map(function(p){ return p.x; }).concat([0]));
      var xMax = Math.max(10, Math.ceil(maxVis * 1.1));
      /* Rank axis: 1 at the top (reverse), and the bottom bound follows the data instead of a
         fixed 100 -- a field of ranks 1-6 squeezed into a 0-100 axis would put every logo in one
         stripe. midY (the quadrant split) moves with it. */
      var yTop = rank ? Math.max(2, Math.ceil(Math.max.apply(null, pts.map(function(p){ return p.y; })) + 0.5)) : MX.yMax;
      midYVal = rank ? (1 + yTop) / 2 : MX.midY;
      chart = new window.Chart(canvas.getContext("2d"), {
        type: "scatter",
        data: { datasets: [{ label: "Brands", data: pts, pointRadius: 0, pointHoverRadius: 0,
                             backgroundColor: "transparent", borderColor: "transparent" }] },
        plugins: [gridPlugin(), quadrantPlugin(), layoutPlugin(), logoPlugin()],
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: { duration: MX.animMs, easing: "easeOutQuart" },
          layout: { padding: { top: MX.padTop, right: MX.padRight, bottom: 0, left: 0 } },
          interaction: { mode: "nearest", intersect: false },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { type: "linear", min: 0, max: xMax,
                 grid: { display: false }, border: { display: true, color: t.axis, width: 1 },
                 ticks: { count: MX.xTicks, color: t.font, maxRotation: 0,
                          callback: function(v){ return Math.round(v) + "%"; } } },
            y: rank
              ? { type: "linear", min: 1, max: yTop, reverse: true,
                  grid: { display: false }, border: { display: false },
                  ticks: { count: MX.yTicks, color: t.font,
                           callback: function(v){ return "#" + Math.round(v); } } }
              : { type: "linear", min: MX.yMin, max: MX.yMax,
                  grid: { display: false }, border: { display: false },
                  ticks: { count: MX.yTicks, color: t.font,
                           callback: function(v){ return Math.round(v); } } }
          }
        }
      });
    }
    function resize(){ if (chart){ try { chart.resize(); } catch(e){} } }
    return { render: render, skeleton: skeleton, destroy: destroy, resize: resize,
             redraw: function(){ if (lastRows) render(lastRows); } };
  }

  /* ================= controller ================= */
  function makeController(root){
    var lineWrap   = root.querySelector(".up-line-wrap");
    var lineCanvas = root.querySelector(".up-line-canvas");
    var legendEl   = root.querySelector(".up-legend");
    var mxWrap     = root.querySelector(".ubo-mx-wrap");
    var mxCanvas   = root.querySelector(".ubo-mx-canvas");
    var tableEl    = root.querySelector(".ubo-table");
    if (!lineWrap || !lineCanvas || !tableEl || !mxWrap || !mxCanvas) return null;

    var instanceId = root.getAttribute("data-instance") || "default";

    /* ---------- markup self-healing ----------
       Bubble markup is pasted by hand, so a placement can sit on an OLDER copy of the root HTML
       forever while its CDN pin moves forward. Anything this file needs but the markup may not
       have yet is created here instead of being a "please re-paste" instruction that silently
       does nothing until someone acts on it. Same idea as core's ensureFirstGrip(). Idempotent. */
    function ensureChrome(){
      var chartTools = root.querySelector(".ubo-head-tools");
      if (chartTools && !root.querySelector(".ubo-hide")){
        var eye = document.createElement("button");
        eye.className = "ubo-hide ubo-iconbtn";
        eye.type = "button";
        eye.setAttribute("data-tip", "Hide");
        eye.setAttribute("aria-label", "Hide");
        eye.innerHTML =
          '<svg class="ic-hide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<svg class="ic-show" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
        chartTools.appendChild(eye);
      }
      var ys = root.querySelector(".ubo-yaxis");
      if (chartTools && !ys){
        ys = document.createElement("div");
        ys.className = "ubo-yaxis";
        ys.setAttribute("role", "tablist");
        ys.setAttribute("aria-label", "Y axis");
        ys.innerHTML = '<button class="ubo-yaxis-btn is-active" data-yaxis="sentiment" type="button" role="tab">Sentiment</button>' +
                       '<button class="ubo-yaxis-btn" data-yaxis="ranking" type="button" role="tab">Ranking</button>';
      }
      /* Order, not just presence: the Y-axis switch sits LEFT of the Linechart|Landscape switch.
         Moving it here (rather than only inserting it when missing) means a placement that still
         has the old markup order gets corrected too, without a re-paste. */
      var typeSeg = root.querySelector('.ubo-seg[aria-label="Chart type"]');
      if (chartTools && ys && typeSeg && ys.nextElementSibling !== typeSeg){
        chartTools.insertBefore(ys, typeSeg);
      } else if (chartTools && ys && !ys.parentNode){
        chartTools.appendChild(ys);
      }
      /* Export: an old placement has it as a bare 32px icon button (.ubo-export.ubo-iconbtn).
         Upgrade it in place to the app-wide full button rather than leaving one table with a
         different-looking Export than every other table. */
      var oldExport = root.querySelector(".ubo-export");
      if (oldExport && !root.querySelector(".up-export")){
        oldExport.className = "up-export";
        oldExport.removeAttribute("data-tip");
        oldExport.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
          '<span>Export</span>';
      }
      /* The Linechart | Landscape switcher ships icon-free. Older pasted markup still carries an
         SVG in each button, so strip them here rather than leaving the switcher looking different
         depending on how old a placement's HTML is. */
      Array.prototype.slice.call(root.querySelectorAll("[data-chartmode] svg")).forEach(function(svg){
        svg.parentNode.removeChild(svg);
      });
      /* The table container needs core's .up-table for its frame/background. */
      if (tableEl && !tableEl.classList.contains("up-table")) tableEl.classList.add("up-table");
    }
    ensureChrome();

    var myCtrlId = "ubo_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* TWO firing shapes on purpose, and they are not interchangeable:
       · fireRaw — every event of this component EXCEPT search sends a bare value ("day", a
         company_id, "active"), exactly like visibility-chart, so the Bubble side needs no regex.
         UC.makeFire cannot be used for these: it JSON.stringify()s its payload, which would turn
         a company_id into the 4-character string "c1" WITH quotes and break every workflow reading
         it (found live — the events arrived quoted before this split existed).
       · fire (UC.makeFire) — search only, because search has always shipped a JSON object
         (query/query_folded/query_de/requestId) and Bubble already parses it by regex there. */
    function fireRaw(attr, fallbackName, value){
      var fnName = root.getAttribute(attr) || fallbackName;
      var fn = UC.resolveBubbleFn(fnName);
      if (typeof fn === "function"){ try { fn(String(value == null ? "" : value)); } catch(e){} }
      else if (window.console){
        console.warn("[brands-overview] " + fnName + " not found on window/parent/top or any " +
          "reachable iframe — this action reached no Bubble workflow. Check the Toolbox element's name.");
      }
      try { root.dispatchEvent(new CustomEvent(fallbackName, { detail: value, bubbles: true })); } catch(e){}
    }
    var fire = UC.makeFire(root, { label: "brands-overview" });

    /* ---- persisted prefs (per instance) ---- */
    function key(n){ return "ubo_" + n + "__" + instanceId; }
    function readLS(n, fallback){ try { var v = window.localStorage.getItem(key(n)); return v == null ? fallback : v; } catch(e){ return fallback; } }
    function writeLS(n, v){ try { window.localStorage.setItem(key(n), v); } catch(e){} }
    /* Page-wide, not per instance: core owns the preference and broadcasts changes, so setting the
       scale in visibility-chart's gear applies here too (and the other way round). */
    var colorScale = UC.getColorScalePref ? UC.getColorScalePref() : "default";
    var chartMode = (readLS("chartmode", "line") === "landscape") ? "landscape" : "line";
    var yAxis = (readLS("yaxis", "sentiment") === "ranking") ? "ranking" : "sentiment";
    /* Column model in the shape UC.makeColumns expects (w / min / prio), so this table gets the
       same width behaviour as every other one: drag the Brand column, columns drop by prio when
       the box genuinely runs out of room, both persisted per instance. */
    var COLS_ALL = [
      { key: "visibility", label: "Visibility", w: "minmax(120px, 1fr)", min: 120, prio: 30 },
      { key: "ranking",    label: "Ranking",    w: "minmax(112px, 1fr)", min: 112, prio: 20 },
      { key: "sentiment",  label: "Sentiment",  w: "minmax(120px, 1fr)", min: 120, prio: 10 },
      /* Inactive-only, and the inverse of the three above — see cfg.isHidden below. */
      { key: "deactivated", label: "Deactivated", w: "minmax(140px, 0.8fr)", min: 140, prio: 5 }
    ];
    var METRIC_COLS = COLS_ALL.filter(function(c){ return c.key !== "deactivated"; });

    function readProcessing(){
      var a = root.getAttribute("data-processing"), b = root.getAttribute("data-processing2");
      var pa = (a === "IS_PROCESSING" || a == null) ? false : isYes(a);
      var pb = (b === "IS_PROCESSING_2" || b == null) ? false : isYes(b);
      return pa || pb;
    }
    var LOADING_EXPLICIT = (window.__uboLoadingExplicit = window.__uboLoadingExplicit || {});
    function isLoading(){ return LOADING_EXPLICIT[instanceId] ? !!state.loading : readProcessing(); }

    var state = {
      loading: readProcessing(),
      hasLine: false, hasTable: false, linePending: false,
      series: [], companies: [], filterCompanies: [], tableRows: [], inactiveRows: [],
      totalCount: null, totalCountInactive: null,
      status: "active", query: ""
    };

    var SORT_STORE  = (window.__uboSort = window.__uboSort || {});
    var GRAN_STORE  = (window.__uboGran = window.__uboGran || {});
    var GRAN_PICKED = (window.__uboGranPicked = window.__uboGranPicked || {});
    /* Chart hidden/shown survives a Bubble re-render of the markup, per instance — exactly the
       window.__ccHidden shape citations-combo-chart uses for its own Hide button. */
    var HIDDEN_STORE = (window.__uboHidden = window.__uboHidden || {});
    var INIT_COMPANIES = (window.__uboInitCompanies = window.__uboInitCompanies || {});
    var USER_FILTERED  = (window.__uboUserFiltered = window.__uboUserFiltered || {});
    var sortField = (SORT_STORE[instanceId] && SORT_STORE[instanceId].field) || "visibility";
    var sortDir   = (SORT_STORE[instanceId] && SORT_STORE[instanceId].dir) || "desc";
    var curGran   = (GRAN_STORE[instanceId] === "week" || GRAN_STORE[instanceId] === "month") ? GRAN_STORE[instanceId] : "day";

    function isOwner(){ return !root.__uboController || root.__uboController.__ctrlId === myCtrlId; }
    function darkNow(){ return isDark; }

    /* ---------- charts ---------- */
    var line = UC.makeLine({
      wrap: lineWrap, canvas: lineCanvas, legend: legendEl,
      isDark: darkNow, isOwner: isOwner, gran: function(){ return curGran; }
    });
    var matrix = makeMatrix({
      wrap: mxWrap, canvas: mxCanvas, isDark: darkNow, isOwner: isOwner,
      getYAxis: function(){ return yAxis; },
      onPick: function(id){ fireRaw("data-rowclick-fn", "uboRowClick", id); }
    });

    /* Legend items fire the same company_id event a table row does — explicit request. makeLine
       renders the legend, so the click is delegated from the legend container here rather than
       pushed into the shared kit (no other consumer wants clickable legend items). */
    if (legendEl && !legendEl.__uboLegendBound){
      legendEl.__uboLegendBound = true;
      legendEl.addEventListener("click", function(e){
        var item = e.target.closest(".up-company-item");
        if (!item) return;
        /* data-company-id, not data-id: that is the attribute makeLine's legend renderer writes
           (verified against core.js's legItemHtml — reading data-id silently produced null and no
           event at all, which is exactly the kind of miss that only shows up when you click it). */
        var id = item.getAttribute("data-company-id");
        if (id) fireRaw("data-rowclick-fn", "uboRowClick", id);
      });
    }

    function granBtns(){ return Array.prototype.slice.call(root.querySelectorAll(".vc-gran-btn")); }
    function syncGran(){ granBtns().forEach(function(b){ b.classList.toggle("is-active", b.getAttribute("data-gran") === curGran); }); }
    function seriesRangeDays(){
      var days = [];
      (state.series || []).forEach(function(p){ if (p && p.day != null) days.push(String(p.day)); });
      if (!days.length) return 0;
      days.sort();
      var a = Date.parse(days[0]), b = Date.parse(days[days.length - 1]);
      if (isNaN(a) || isNaN(b)) return days.length;
      return Math.round((b - a) / 86400000) + 1;
    }
    function applyGranAvailability(){
      var r = seriesRangeDays();
      granBtns().forEach(function(b){
        var g = b.getAttribute("data-gran");
        var dis = (g === "week" && r > 0 && r < 8) || (g === "month" && r > 0 && r < 31);
        b.classList.toggle("is-disabled", dis);
        if (dis) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
      });
      var act = granBtns().filter(function(b){ return b.getAttribute("data-gran") === curGran; })[0];
      if (act && act.classList.contains("is-disabled")){ curGran = "day"; GRAN_STORE[instanceId] = "day"; syncGran(); }
    }

    function syncYAxis(){
      Array.prototype.slice.call(root.querySelectorAll("[data-yaxis]")).forEach(function(b){
        b.classList.toggle("is-active", b.getAttribute("data-yaxis") === yAxis);
      });
      var cap = root.querySelector(".ubo-mx-legend-y span");
      if (cap) cap.textContent = (yAxis === "ranking") ? "Ranking" : "Sentiment";
    }
    function syncChartMode(){
      root.classList.toggle("is-landscape", chartMode === "landscape");
      syncYAxis();
      Array.prototype.slice.call(root.querySelectorAll("[data-chartmode]")).forEach(function(b){
        b.classList.toggle("is-active", b.getAttribute("data-chartmode") === chartMode);
      });
      /* Granularity only means something for the time series — the matrix is a snapshot. */
      var gran = root.querySelector(".vc-gran");
      if (gran) gran.style.display = (chartMode === "line") ? "" : "none";
    }
    function renderChartSide(){
      if (!isOwner()) return;
      var loading = state.loading || !state.hasLine || state.linePending;
      root.classList.toggle("is-line-loading", loading);
      if (chartMode === "landscape"){
        line.destroy();
        if (loading || !state.hasTable){ matrix.skeleton(); return; }
        matrix.render(state.tableRows);
        return;
      }
      matrix.destroy();
      if (loading){ scaleKit.close(); line.skeleton(); return; }
      line.render(UC.buildLineDatasets(state.series, state.companies || [], colorScale));
    }

    var scaleKit = UC.makeScaleMenu({
      btn: root.querySelector(".ubo-scale-btn"),
      getIsDark: darkNow,
      getScale: function(){ return colorScale; },
      setScale: function(k){ colorScale = k; if (UC.setColorScalePref) UC.setColorScalePref(k); },
      defaultColors: function(){
        return UC.buildLineDatasets(state.series, state.companies || [], null)
          .datasets.map(function(d){ return d.__baseColor; });
      },
      onChange: function(){ renderChartSide(); },
      closeOthers: function(){ closePops(null); }
    });
    window.addEventListener("up-colorscale-change", function(e){
      var v = e && e.detail ? e.detail.value : null;
      if (!v || v === colorScale) return;
      colorScale = v;
      renderChartSide();
      if (scaleKit && scaleKit.isOpen && scaleKit.isOpen()) scaleKit.populate();
    });

    /* ---------- table ---------- */
    var HASH_ICON = UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ');
    var MORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';

    /* The table kit: grid template, column dropping, the Brand column's drag handle and the
       Table Settings menu all come from core now. The Inactive view is a different table (Brand /
       Deactivated / Actions) with nothing resizable or hideable, so it is fed through cfg.isHidden
       rather than through the user's saved column prefs -- switching back must not have clobbered
       their choices. */
    var IDX_W = 44;
    var colsKit = UC.makeColumns({
      root: root, state: state, columns: COLS_ALL,
      storePrefix: "ubo", instanceId: instanceId,
      firstKey: "brand", firstMin: 160, actionsMin: 56,
      /* No "#" column in the Inactive list — it is not a ranking, so the lead track collapses. */
      leadWidth: function(){ return state.status === "inactive" ? 0 : IDX_W; },
      badgeSel: ".ubo-cols-badge", cellPrefixes: ["up", "ubo"],
      isHidden: function(c){
        return (c.key === "deactivated") ? (state.status !== "inactive")
                                         : (state.status === "inactive");
      },
      onChange: function(){ renderTable(); }
    });
    state.cols = colsKit.readCols();
    state.widths = colsKit.readWidths();
    var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
    var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
    var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
    function colOn(k){
      if (k === "deactivated") return state.status === "inactive";
      return state.cols[k] !== false && state.status !== "inactive";
    }
    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();
      startResize(e);
    });
    function infoIcon(kind){
      return '<span class="up-th-info" data-explain="' + kind + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>';
    }
    /* Every cell carries its column key as a class (up-th-<key> / up-td-<key>) because that is
       what core's applyCols() shows and hides by. The Brand header is the resizable one; core
       appends the .up-grip to it itself. */
    function headHtml(){
      if (state.status === "inactive"){
        return '<div class="up-thead">' +
          '<div class="up-th up-th-brand">Brand</div>' +
          '<div class="up-th up-th-deactivated">Deactivated</div>' +
          '<div class="up-th up-th-act"></div></div>';
      }
      var h = '<div class="up-thead">' +
        '<div class="up-th up-th-idx">' + HASH_ICON + '</div>' +
        '<div class="up-th up-th-brand">Brand</div>';
      if (colOn("visibility")) h += '<div class="up-th up-th-visibility">Visibility' + infoIcon("visibility") + '</div>';
      if (colOn("ranking"))    h += '<div class="up-th up-th-ranking">Ranking' + infoIcon("ranking") + '</div>';
      if (colOn("sentiment"))  h += '<div class="up-th up-th-sentiment">Sentiment' + infoIcon("sentiment") + '</div>';
      h += '<div class="up-th up-th-act"></div></div>';
      return h;
    }
    function skeletonHtml(){
      var cols = (state.status === "inactive")
        ? [{ w:70, jitter:18, logo:true }, 64, { w:20, cls:"up-td-act" }]
        : [{ w:12, cls:"up-td-idx" }, { w:70, jitter:18, logo:true }]
            .concat(colOn("visibility") ? [46] : [])
            .concat(colOn("ranking")    ? [52] : [])
            .concat(colOn("sentiment")  ? [56] : [])
            .concat([{ w:20, cls:"up-td-act" }]);
      return headHtml() + '<div class="up-tbody">' +
        UC.skeletonRows({ count: 7, rowClass: "up-row", cellClass: "up-td", cols: cols }) + '</div>';
    }
    function logoHtml(url){
      return url
        ? '<span class="up-logo-box has-img"><img src="' + esc(url) + '" onerror="this.style.visibility=\'hidden\'"/></span>'
        : '<span class="up-logo-box"></span>';
    }
    function actionsCell(){
      return '<div class="up-td up-td-act">' +
        '<button class="ubo-actbtn" type="button" data-actmenu aria-label="Actions" aria-haspopup="menu">' + MORE_SVG + '</button></div>';
    }
    function activeRowHtml(r, i){
      var pos = (r.position != null) ? Number(r.position) : (i + 1);
      var visNull = (r.visibility_pct == null || r.visibility_pct === "");
      var vis = '<span class="up-num' + (visNull ? " is-empty" : "") + '">' +
        (visNull ? "–" : UC.fmtPct(r.visibility_pct)) + '</span>' +
        UC.trendChip(r.visibility_delta_pct, { decimals: false, inverted: false, suffix: "%" });
      var rank = '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmt1(r.avg_rank) + '</span></span>' +
        UC.trendChip(r.avg_rank_delta, { decimals: true, inverted: true });
      var sNull = (r.sentiment == null || r.sentiment === "" || !isFinite(Number(r.sentiment)));
      var sc = sNull ? "#9E9E9E" : sentColor(r.sentiment);
      var sent = '<span class="up-sent"><span class="up-sent-dot" style="background:' + sc + '"></span>' +
        '<span class="up-sent-val' + (sNull ? " is-empty" : "") + '">' + (sNull ? "–" : Math.round(Number(r.sentiment))) + '</span></span>' +
        UC.trendChip(r.sentiment_delta, { decimals: true, inverted: false });
      var h = '<div class="up-row" data-id="' + esc(String(r.company_id == null ? "" : r.company_id)) + '">' +
        '<div class="up-td up-td-idx">' + pos + '</div>' +
        '<div class="up-td up-td-brand">' + logoHtml(r.logo_url || r.favicon_url) +
          '<span class="ubo-brand-name">' + esc(r.name == null ? "" : r.name) + '</span></div>';
      if (colOn("visibility")) h += '<div class="up-td up-td-visibility">' + vis + '</div>';
      if (colOn("ranking"))    h += '<div class="up-td up-td-ranking">' + rank + '</div>';
      if (colOn("sentiment"))  h += '<div class="up-td up-td-sentiment">' + sent + '</div>';
      return h + actionsCell() + '</div>';
    }
    function inactiveRowHtml(r){
      return '<div class="up-row" data-id="' + esc(String(r.company_id == null ? "" : r.company_id)) + '">' +
        '<div class="up-td up-td-brand">' + logoHtml(r.logo_url || r.favicon_url) +
          '<span class="ubo-brand-name">' + esc(r.name == null ? "" : r.name) + '</span></div>' +
        '<div class="up-td up-td-deactivated"><span class="ubo-deact">' + esc(UC.fmtDate(r.deactivated_at) || "–") + '</span></div>' +
        actionsCell() + '</div>';
    }
    var emptyGraceTimer = null;
    function renderTable(){
      if (!isOwner()) return;
      var inactive = state.status === "inactive";
      var hasData = inactive ? true : state.hasTable;
      if (isLoading() || !hasData){
        if (emptyGraceTimer){ clearTimeout(emptyGraceTimer); emptyGraceTimer = null; }
        tableEl.innerHTML = skeletonHtml();
        applyCols();
        return;
      }
      var rows = inactive ? (state.inactiveRows || []) : (state.tableRows || []);
      var q = (state.query || "").trim().toLowerCase();
      if (q) rows = rows.filter(function(r){ return String(r.name || "").toLowerCase().indexOf(q) > -1; });
      if (!rows.length){
        /* An empty delivery can be an interim "clearing" step before real data lands a beat later.
           Same short grace window visibility-chart uses before committing to "No data". */
        if (!emptyGraceTimer){
          tableEl.innerHTML = skeletonHtml();
          applyCols();
          emptyGraceTimer = setTimeout(function(){
            emptyGraceTimer = null;
            var live = (state.status === "inactive") ? state.inactiveRows : state.tableRows;
            if (isLoading() || (Array.isArray(live) && live.length && !q)) return;
            tableEl.innerHTML = headHtml() + '<div class="up-empty-mini">' + (q ? "No matches" : "No data") + '</div>';
            applyCols();
          }, 600);
        }
        return;
      }
      if (emptyGraceTimer){ clearTimeout(emptyGraceTimer); emptyGraceTimer = null; }
      var body = rows.map(inactive ? inactiveRowHtml : activeRowHtml).join("");
      tableEl.innerHTML = headHtml() + '<div class="up-tbody">' + body + '</div>';
      applyCols();
      Array.prototype.slice.call(tableEl.querySelectorAll(".up-row")).forEach(function(row){
        var id = row.getAttribute("data-id");
        if (!inactive){
          row.addEventListener("mouseenter", function(){ line.highlight(id); });
          row.addEventListener("mouseleave", function(){ line.highlight(null); });
        }
        row.addEventListener("click", function(e){
          if (e.target.closest("[data-actmenu]")) return;   // the menu button is not a row click
          fireRaw("data-rowclick-fn", "uboRowClick", id);
        });
      });
    }
    function setHeadCount(){
      var hr = root.querySelector(".ubo-heading-table");
      var cn = root.querySelector(".ubo-head-count");
      if (!hr || !cn) return;
      if (isLoading()){ cn.textContent = ""; cn.classList.add("is-sk"); hr.classList.add("has-count"); return; }
      cn.classList.remove("is-sk");
      var n = (state.status === "inactive") ? state.totalCountInactive : state.totalCount;
      if (n != null && n !== ""){ cn.textContent = UC.fmtTotal(n); hr.classList.add("has-count"); }
      else { hr.classList.remove("has-count"); }
    }
    function syncStatusSwitch(){
      Array.prototype.slice.call(root.querySelectorAll("[data-status]")).forEach(function(b){
        var s = b.getAttribute("data-status");
        b.classList.toggle("is-active", s === state.status);
        /* Only the ACTIVE tab carries a number, and it carries it whether or not you are standing
           on it: total_count is the figure the user actually tracks. Inactive is deliberately
           bare — an inactive-brand count is noise next to it. */
        var n = b.querySelector(".ubo-seg-n");
        if (!n) return;
        var v = state.totalCount;
        var show = (s === "active") && !isLoading() && v != null && v !== "";
        n.textContent = show ? UC.fmtTotal(v) : "";
        n.style.display = show ? "" : "none";
      });
      /* Sort and column settings describe the ACTIVE table's metric columns; the Inactive table has
         none of them, so the controls go away instead of sitting there doing nothing. */
      root.classList.toggle("is-inactive-view", state.status === "inactive");
    }

    function render(){
      if (root.__uboController && root.__uboController.__ctrlId !== myCtrlId) return;
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      /* Hidden-state is restored on every render, so a Bubble re-render of the markup does not
         silently pop the chart back open. */
      if (HIDDEN_STORE[instanceId]){
        root.classList.add("is-hidden-view");
        var hbtn = root.querySelector(".ubo-hide");
        if (hbtn){ hbtn.setAttribute("data-tip", "Show"); hbtn.setAttribute("aria-label", "Show"); }
      }
      syncChartMode(); syncGran(); syncStatusSwitch(); setHeadCount();
      renderTable(); renderChartSide(); syncFilterBadge(); syncColsBadge();
    }

    /* ---------- column explainers ---------- */
    var EXPLAIN_FALLBACK = {
      visibility: { h: "Visibility", t: "How often the brand appears in AI answers for the tracked prompts, plus the change against the previous period." },
      ranking:    { h: "Ranking", t: "The brand's average position among all brands mentioned, plus the change against the previous period. A lower number is better." },
      sentiment:  { h: "Sentiment", t: "How positively the brand is described when it's mentioned, plus the change against the previous period." }
    };
    function explainInfo(kind){
      if (UC.explainCopy){
        var trend = ", plus the change against the previous period";
        if (kind === "visibility") return UC.explainCopy("visibility", { scope: " for the tracked prompts", trend: trend });
        if (kind === "ranking"){ var r = UC.explainCopy("rank", { trend: trend }); return r ? { h: "Ranking", t: r.t } : null; }
        if (kind === "sentiment") return UC.explainCopy("sentiment", { trend: trend });
      }
      return EXPLAIN_FALLBACK[kind] || null;
    }
    function explainVisual(kind){
      if (kind === "ranking") return '<span class="up-explain-row">' + HASH_ICON + '<span>2.3</span></span>';
      if (kind === "sentiment"){
        return '<span class="up-explain-row">78' +
          '<span class="up-explain-up">' + UC.TREND_UP + '</span><span class="up-explain-up">4</span></span>';
      }
      return '<span class="up-explain-row">18.4%' +
             '<span class="up-explain-up">' + UC.TREND_UP + '</span>' +
             '<span class="up-explain-up">2.9%</span></span>';
    }
    if (UC.makeExplain){
      UC.makeExplain({
        root: root, triggerSel: ".up-th-info", getIsDark: darkNow,
        html: function(kind){
          var info = explainInfo(kind);
          if (!info) return "";
          return '<div class="up-explain-vis">' + explainVisual(kind) + '</div>' +
                 '<div class="up-explain-h">' + esc(info.h) + '</div>' +
                 '<div class="up-explain-t">' + esc(info.t) + '</div>';
        }
      });
    }
    UC.makeTooltips(root, darkNow);

    /* ---------- dropdowns ---------- */
    var POP_GROUP = "ubo-" + instanceId;
    var sortWrap   = root.querySelector(".ubo-sort");
    var sortMenu   = root.querySelector(".up-sort-menu");
    var filterWrap = root.querySelector(".ubo-filter");
    var filterMenu = root.querySelector(".up-ment-menu");
    var colsWrap   = root.querySelector(".ubo-cols");
    var colsMenu   = root.querySelector(".up-cols-menu");
    var sortPop   = UC.makePopover({ wrap: sortWrap,   menu: sortMenu,   opener: root.querySelector(".ubo-sort-btn"),   group: POP_GROUP });
    var filterPop = UC.makePopover({ wrap: filterWrap, menu: filterMenu, opener: root.querySelector(".ubo-filter-btn"), group: POP_GROUP });
    var colsPop   = UC.makePopover({ wrap: colsWrap,   menu: colsMenu,   opener: root.querySelector(".ubo-cols-btn"),   group: POP_GROUP });
    function popOf(w){ return w === filterWrap ? filterPop : (w === colsWrap ? colsPop : sortPop); }
    function closePops(except){
      [sortWrap, filterWrap, colsWrap].forEach(function(w){ if (w && w !== except) popOf(w).close(false); });
      closeActMenu();
      if (except !== "scale") scaleKit.close();
    }

    /* ---- All Brands dropdown (chart series filter) — same contract as visibility-chart ---- */
    var MAX_FILTER_SEL = UC.MAX_LINE_SERIES;
    var filterSel = {}, filterQuery = "";
    function activeCompanyIds(){
      var ids = [], seen = {};
      (state.companies || []).forEach(function(c){
        if (!c || c.company_id == null) return;
        var id = String(c.company_id);
        if (!seen[id]){ seen[id] = true; ids.push(id); }
      });
      return ids;
    }
    function seedFilter(){
      filterSel = {};
      var on = {};
      activeCompanyIds().forEach(function(id){ on[id] = true; });
      (state.filterCompanies || []).forEach(function(c){
        if (!c || c.company_id == null) return;
        filterSel[String(c.company_id)] = !!on[String(c.company_id)];
      });
    }
    function isAtInitialSelection(){
      var target = {}, n = 0;
      (INIT_COMPANIES[instanceId] || activeCompanyIds()).forEach(function(id){ target[id] = true; n++; });
      var cur = Object.keys(filterSel).filter(function(k){ return filterSel[k]; });
      if (cur.length !== n) return false;
      return cur.every(function(id){ return target[id]; });
    }
    function syncFilterBadge(){
      var badge = root.querySelector(".ubo-filter-badge");
      if (!badge) return;
      var active = activeCompanyIds().length;
      var maxSel = Math.min((state.filterCompanies || []).length, MAX_FILTER_SEL);
      var show = !!USER_FILTERED[instanceId] && active > 0 && active < maxSel;
      badge.textContent = show ? String(active) : "";
      badge.classList.toggle("is-visible", show);
    }
    function applyFilterSearch(){
      if (!filterMenu) return;
      var inp = filterMenu.querySelector(".up-ment-search");
      if (inp) filterQuery = inp.value;
      var q = (filterQuery || "").trim().toLowerCase();
      var items = filterMenu.querySelectorAll(".up-filter-item[data-id]");
      var shown = 0;
      Array.prototype.forEach.call(items, function(it){
        var m = !q || (it.getAttribute("data-name") || "").indexOf(q) > -1;
        it.style.display = m ? "" : "none";
        if (m) shown++;
      });
      var nr = filterMenu.querySelector(".up-ment-noresult");
      if (nr) nr.style.display = (items.length && shown === 0) ? "" : "none";
    }
    function populateFilter(){
      if (!filterMenu) return;
      var list = state.filterCompanies || [];
      if (!list.length){ filterMenu.innerHTML = '<div class="up-ment-empty">No brands</div>'; return; }
      var selCount = list.reduce(function(n, c){ return n + (filterSel[String(c.company_id)] ? 1 : 0); }, 0);
      var atMax = selCount >= MAX_FILTER_SEL;
      var head = '<div class="up-filter-head"><span class="up-filter-title">Brands</span>' +
        '<span class="ubo-filter-head-actions">' +
          (!isAtInitialSelection() ? '<button class="up-pop-action" type="button" data-brands-reset>Reset</button>' : '') +
          ((atMax || selCount === list.length) ? '<button class="up-pop-action" type="button" data-brands-clear>Deselect all</button>' : '') +
          '<span class="ubo-filter-count">' + selCount + '/' + Math.min(list.length, MAX_FILTER_SEL) + '</span>' +
        '</span></div>';
      var search = '<div class="up-ment-searchwrap">' +
        '<input class="up-ment-search" type="text" placeholder="Search brands..." autocomplete="off" spellcheck="false" value="' + esc(filterQuery) + '"/>' +
        '<button class="up-ment-searchclear" type="button" aria-label="Clear brand search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>';
      var items = list.map(function(c){
        var id = String(c.company_id), checked = !!filterSel[id], disabled = !checked && atMax;
        var nm = String(c.name || id);
        var fav = c.favicon_url || c.logo_url || c.favicon || "";
        var logo = fav
          ? '<span class="up-ment-logo"><img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.style.visibility=\'hidden\'"/></span>'
          : '<span class="up-ment-logo" style="background:' + esc(c.color || "#9e9e9e") + '"></span>';
        return '<div class="up-filter-item' + (checked ? " is-checked" : "") + (disabled ? " is-disabled" : "") +
          '" data-id="' + esc(id) + '" data-name="' + esc(nm.toLowerCase()) + '" title="' + esc(nm) + '">' +
          '<span class="up-filter-check">' + CHECK_SVG + '</span>' + logo +
          '<span class="up-ment-name">' + esc(nm) + '</span></div>';
      }).join("");
      filterMenu.innerHTML = head + search +
        '<div class="up-filter-list up-ment-list">' + items + '<div class="up-ment-noresult" style="display:none">No matches</div></div>' +
        '<button class="up-filter-submit" type="button" data-brands-apply>Apply</button>';
      applyFilterSearch();
    }
    function fireBrandsSubmit(){
      USER_FILTERED[instanceId] = true;
      fireRaw("data-submit-fn", "uboSubmitBrands", Object.keys(filterSel).filter(function(k){ return filterSel[k]; }).join(","));
      if (filterWrap) filterPop.close(false);
    }

    /* ---- sort ---- */
    var SORT_LABELS = [["visibility","Visibility"],["ranking","Ranking"],["sentiment","Sentiment"]];
    var SORT_OUT = { visibility: "visibility", ranking: "rank", sentiment: "sentiment" };
    function fireSort(){ fireRaw("data-sort-fn", "uboSortTable", (SORT_OUT[sortField] || sortField) + "_" + sortDir); }
    function populateSort(){
      if (!sortMenu) return;
      var opts = SORT_LABELS.map(function(o){
        return '<div class="up-pop-opt ' + (sortField === o[0] ? "is-active" : "") + '" data-field="' + o[0] + '">' + o[1] +
          '<svg class="up-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>';
      }).join("");
      sortMenu.innerHTML = '<div class="up-pop-head">Sort by</div>' + opts +
        '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span><span class="up-switch ' + (sortDir === "desc" ? "is-on" : "") + '"></span></div>';
    }


    /* ---- row actions (three-dot menu) ----
       Local by §25 (single consumer). Body-mounted for the same reason the Chart Settings menu is:
       the table box clips overflow to keep its rounded corners, so a plain absolute child would be
       cut off on the last rows. Positioning, outside-click and Escape mirror UC.makeScaleMenu. */
    var actMenu = null, actOpenFor = null;
    var ACTIONS_ACTIVE = [
      { key: "setinactive", label: "Set Inactive", fn: "data-setinactive-fn", ev: "uboSetInactive" },
      { key: "edit",        label: "Edit",         fn: "data-edit-fn",        ev: "uboEdit" },
      { key: "opendomain",  label: "Open Linked Domain", fn: "data-opendomain-fn", ev: "uboOpenDomain" }
    ];
    var ACTIONS_INACTIVE = [
      { key: "activate",   label: "Activate",           fn: "data-activate-fn",   ev: "uboActivate" },
      { key: "opendomain", label: "Open Linked Domain", fn: "data-opendomain-fn", ev: "uboOpenDomain" }
    ];
    function ensureActMenu(){
      if (actMenu && document.body.contains(actMenu)) return actMenu;
      actMenu = document.createElement("div");
      actMenu.className = "ubo-actmenu";
      actMenu.setAttribute("role", "menu");
      actMenu.setAttribute("aria-hidden", "true");
      actMenu.addEventListener("click", function(e){
        var opt = e.target.closest("[data-action]");
        if (!opt || !actOpenFor) return;
        var list = (state.status === "inactive") ? ACTIONS_INACTIVE : ACTIONS_ACTIVE;
        var def = list.filter(function(a){ return a.key === opt.getAttribute("data-action"); })[0];
        var id = actOpenFor;
        closeActMenu();
        if (def) fireRaw(def.fn, def.ev, id);
      });
      document.body.appendChild(actMenu);
      return actMenu;
    }
    function closeActMenu(){
      if (!actMenu || !actOpenFor) return;
      if (actMenu.contains(document.activeElement)){ try { document.activeElement.blur(); } catch(e){} }
      actMenu.classList.remove("is-shown");
      actMenu.setAttribute("aria-hidden", "true");
      var prev = root.querySelector(".ubo-actbtn.is-open");
      if (prev) prev.classList.remove("is-open");
      actOpenFor = null;
    }
    function openActMenu(btn, id){
      ensureActMenu();
      closePops(null);
      actOpenFor = id;
      btn.classList.add("is-open");
      var list = (state.status === "inactive") ? ACTIONS_INACTIVE : ACTIONS_ACTIVE;
      actMenu.innerHTML = list.map(function(a){
        return '<div class="up-pop-opt" data-action="' + a.key + '">' + esc(a.label) + '</div>';
      }).join("");
      actMenu.setAttribute("data-theme", isDark ? "dark" : "light");
      var r = btn.getBoundingClientRect();
      actMenu.style.visibility = "hidden";
      actMenu.setAttribute("aria-hidden", "false");
      actMenu.classList.add("is-shown");
      var mh = actMenu.getBoundingClientRect().height;
      /* Flip above the button when there isn't room below — the last rows of a long table are
         exactly where a menu that only ever opens downward runs off the viewport. */
      var top = (r.bottom + 6 + mh > window.innerHeight) ? (r.top - 6 - mh) : (r.bottom + 6);
      actMenu.style.top = Math.max(8, top) + "px";
      actMenu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
      actMenu.style.visibility = "";
    }
    if (!root.__uboActBound){
      root.__uboActBound = true;
      document.addEventListener("pointerdown", function(e){
        if (!actOpenFor) return;
        if (actMenu && actMenu.contains(e.target)) return;
        if (e.target.closest && e.target.closest("[data-actmenu]")) return;
        closeActMenu();
      });
      document.addEventListener("keydown", function(e){
        if (!actOpenFor) return;
        if (e.key === "Escape" || e.key === "Esc") closeActMenu();
      });
      window.addEventListener("resize", function(){ if (actOpenFor) closeActMenu(); });
    }

    /* ---------- search ---------- */
    var searchKit = UC.makeSearch ? UC.makeSearch({
      root: root,
      box: root.querySelector(".up-search"),
      input: root.querySelector(".up-search-input"),
      state: state, prefix: "ubo", instanceId: instanceId,
      onRender: function(){ renderTable(); },
      onFire: function(payload){ fire("data-search-fn", "uboSearch", payload); }
    }) : null;

    /* ---------- click delegation ---------- */
    if (!root.__uboDelegated){
      root.__uboDelegated = true;
      /* pointerdown for the "close open popovers" decision (a click decides at RELEASE, which for
         anything draggable inside a menu can land outside it — the bug already fixed app-wide). */
      root.addEventListener("pointerdown", function(e){
        var inMenu = e.target.closest(".up-sort-menu, .up-ment-menu, .up-cols-menu, .ubo-actmenu");
        var onOpener = e.target.closest(".ubo-sort-btn, .ubo-filter-btn, .ubo-cols-btn, .ubo-scale-btn, [data-actmenu]");
        if (!inMenu && !onOpener) closePops(null);
      });
      root.addEventListener("click", function(e){
        var gran = e.target.closest(".vc-gran-btn");
        if (gran){
          if (gran.classList.contains("is-disabled")) return;
          var g = gran.getAttribute("data-gran");
          if (g === curGran) return;
          curGran = g; GRAN_STORE[instanceId] = g; GRAN_PICKED[instanceId] = true; syncGran();
          fireRaw("data-gran-fn", "uboGranularity", g);
          return;
        }
        var cm = e.target.closest("[data-chartmode]");
        if (cm){
          var m = cm.getAttribute("data-chartmode");
          if (m === chartMode) return;
          chartMode = m; writeLS("chartmode", m);
          /* Purely client-side: both views are drawn from the SAME already-loaded RPC payload, so
             there is nothing to refetch and no Bubble event to fire. */
          syncChartMode(); renderChartSide();
          return;
        }
        var st = e.target.closest("[data-status]");
        if (st){
          var s = st.getAttribute("data-status");
          if (s === state.status) return;
          state.status = s;
          closePops(null);
          setHeadCount(); syncStatusSwitch(); renderTable();
          fireRaw("data-status-fn", "uboStatus", s);
          return;
        }
        var actBtn = e.target.closest("[data-actmenu]");
        if (actBtn){
          e.stopPropagation();
          var rowEl = actBtn.closest(".up-row");
          var rid = rowEl ? rowEl.getAttribute("data-id") : null;
          if (actOpenFor === rid) closeActMenu(); else openActMenu(actBtn, rid);
          return;
        }
        if (e.target.closest(".up-export, .ubo-export")){ fireRaw("data-export-fn", "uboExportTable", instanceId); return; }
        /* The search button was never wired to the kit, so clicking it did nothing at all. */
        if (e.target.closest(".up-search-btn")){
          e.stopPropagation();
          closePops(null);
          if (searchKit) searchKit.toggle();
          return;
        }
        /* Hide/Show the chart container — same toggle, same persistence shape and the same
           post-toggle resize as citations-combo-chart's .combo-hide. */
        if (e.target.closest(".ubo-hide")){
          var hb = e.target.closest(".ubo-hide");
          var collapsed = root.classList.toggle("is-hidden-view");
          HIDDEN_STORE[instanceId] = collapsed;
          hb.setAttribute("data-tip", collapsed ? "Show" : "Hide");
          hb.setAttribute("aria-label", collapsed ? "Show" : "Hide");
          setTimeout(function(){ line.resize(); line.relayoutLegend && line.relayoutLegend(); matrix.resize(); }, 230);
          return;
        }
        var ya = e.target.closest("[data-yaxis]");
        if (ya){
          var yk = ya.getAttribute("data-yaxis");
          if (yk === yAxis) return;
          yAxis = yk; writeLS("yaxis", yk);
          syncYAxis(); renderChartSide();
          return;
        }
        if (e.target.closest(".ubo-filter-btn")){
          e.stopPropagation();
          if (!filterWrap) return;
          var openF = !filterWrap.classList.contains("is-open");
          closePops(filterWrap);
          if (openF){ filterQuery = ""; seedFilter(); populateFilter(); }
          if (openF) filterPop.open(); else filterPop.close(false);
          return;
        }
        if (e.target.closest(".ubo-sort-btn")){
          e.stopPropagation();
          if (!sortWrap) return;
          var openS = !sortWrap.classList.contains("is-open");
          closePops(sortWrap);
          if (openS){ populateSort(); sortPop.open(); } else sortPop.close(false);
          return;
        }
        if (e.target.closest(".ubo-cols-btn")){
          e.stopPropagation();
          if (!colsWrap) return;
          var openC = !colsWrap.classList.contains("is-open");
          closePops(colsWrap);
          if (openC){ populateCols(); colsPop.open(); } else colsPop.close(false);
          return;
        }
        /* --- inside the sort menu --- */
        var sOpt = e.target.closest(".up-sort-menu .up-pop-opt");
        if (sOpt){
          e.stopPropagation();
          sortField = sOpt.getAttribute("data-field");
          SORT_STORE[instanceId] = { field: sortField, dir: sortDir };
          populateSort(); fireSort();
          return;
        }
        var sSwitch = e.target.closest(".up-sort-menu .up-switch");
        if (sSwitch){
          e.stopPropagation();
          sortDir = (sortDir === "desc" ? "asc" : "desc");
          SORT_STORE[instanceId] = { field: sortField, dir: sortDir };
          populateSort(); fireSort();
          return;
        }
        /* --- inside the columns menu --- */
        if (e.target.closest("[data-colsall]")){
          e.stopPropagation();
          selectAllCols();
          return;
        }
        var colRow = e.target.closest(".up-cols-menu [data-col]");
        if (colRow){
          e.stopPropagation();
          if (colRow.classList.contains("is-locked")) return;
          toggleCol(colRow.getAttribute("data-col"));
          return;
        }
        /* --- inside the brands filter menu --- */
        if (e.target.closest("[data-brands-reset]")){
          e.stopPropagation();
          filterSel = {};
          (INIT_COMPANIES[instanceId] || activeCompanyIds()).forEach(function(id){ filterSel[id] = true; });
          populateFilter(); fireBrandsSubmit();
          delete USER_FILTERED[instanceId];
          return;
        }
        if (e.target.closest("[data-brands-clear]")){ e.stopPropagation(); filterSel = {}; populateFilter(); return; }
        if (e.target.closest("[data-brands-apply]")){ e.stopPropagation(); fireBrandsSubmit(); return; }
        if (e.target.closest(".up-ment-searchclear")){
          e.stopPropagation();
          var si = filterMenu && filterMenu.querySelector(".up-ment-search");
          if (si){ si.value = ""; filterQuery = ""; applyFilterSearch(); try { si.focus(); } catch(e2){} }
          return;
        }
        var fItem = e.target.closest(".up-filter-item[data-id]");
        if (fItem){
          e.stopPropagation();
          var fid = fItem.getAttribute("data-id");
          var willCheck = !filterSel[fid];
          if (willCheck){
            var n = (state.filterCompanies || []).reduce(function(a, c){ return a + (filterSel[String(c.company_id)] ? 1 : 0); }, 0);
            if (n >= MAX_FILTER_SEL) return;
          }
          filterSel[fid] = willCheck;
          populateFilter();
          return;
        }
      });
      if (filterMenu) filterMenu.addEventListener("input", function(e){
        if (e.target && e.target.classList && e.target.classList.contains("up-ment-search")) applyFilterSearch();
      });
    }

    /* ---------- responsive ---------- */
    function applyResponsive(){
      var w = root.clientWidth || 0;
      if (w) root.classList.toggle("is-narrow", w < 760);
      root.classList.toggle("ubo-narrow-page", UC.getPageWidth() < 500);
      clearTimeout(root.__uboRespT);
      root.__uboRespT = setTimeout(function(){ line.resize(); matrix.resize(); }, 60);
    }
    if (UC.onResize) UC.onResize(root, applyResponsive);
    /* The legend re-flows itself (balanced rows) only when asked to, and it also owns the
       "hide me below 500px page width" decision — so without a relayout on resize a legend that
       was hidden once (e.g. the window was briefly narrow while the page was still loading) stays
       hidden forever. Same wiring visibility-chart has; leaving it out is what made the legend
       render its 5 items into a zero-height, display:none container here. */
    if (legendEl && window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__uboLegRaf) return;
        root.__uboLegRaf = requestAnimationFrame(function(){ root.__uboLegRaf = null; line.relayoutLegend(); });
      }).observe(legendEl);
    }
    window.addEventListener("resize", function(){
      if (root.__uboWinRaf) return;
      root.__uboWinRaf = requestAnimationFrame(function(){
        root.__uboWinRaf = null; line.relayoutLegend(); applyResponsive();
      });
    });

    if (window.MutationObserver){
      var syncAttrs = function(){
        var wantProc = readProcessing(), wantDark = isYes(root.getAttribute("data-isdark")), changed = false;
        if (wantDark !== isDark){
          isDark = wantDark;
          if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
          matrix.redraw();
          changed = true;
        }
        if (!LOADING_EXPLICIT[instanceId] && wantProc !== state.loading){ state.loading = wantProc; changed = true; }
        if (changed) render();
      };
      new MutationObserver(syncAttrs).observe(root, { attributes: true, attributeFilter: ["data-processing","data-processing2","data-isdark"] });
      syncAttrs();
    }

    populateSort(); populateCols(); seedFilter(); populateFilter();
    applyResponsive();
    render();

    return {
      __ctrlId: myCtrlId,
      reset: function(){
        /* Local state + UI only — fires NO Bubble events (same contract as every other reset* here:
           the caller loads fresh data next, and firing sort/filter events from a reset re-triggers
           the very workflows that are already in flight). */
        sortField = "visibility"; sortDir = "desc";
        SORT_STORE[instanceId] = { field: sortField, dir: sortDir };
        filterSel = {}; filterQuery = "";
        delete USER_FILTERED[instanceId];
        delete INIT_COMPANIES[instanceId];
        state.status = "active"; state.query = "";
        state.series = []; state.companies = []; state.filterCompanies = [];
        state.tableRows = []; state.inactiveRows = [];
        state.totalCount = null; state.totalCountInactive = null;
        state.hasLine = false; state.hasTable = false; state.linePending = false;
        if (searchKit && searchKit.reset) searchKit.reset();
        closePops(null);
        if (window.__uboCache){ try { delete window.__uboCache[instanceId]; } catch(e){} }
        populateSort(); populateCols(); populateFilter(); syncFilterBadge(); syncColsBadge();
        render();
        return true;
      },
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
        }
        if (params.companies != null){
          state.companies = Array.isArray(params.companies) ? params.companies : [];
          if (!INIT_COMPANIES.hasOwnProperty(instanceId) && state.companies.length){
            INIT_COMPANIES[instanceId] = state.companies.map(function(c){ return String(c.company_id); });
          }
          seedFilter(); populateFilter();
        }
        if (params.filterCompanies != null){
          state.filterCompanies = Array.isArray(params.filterCompanies) ? params.filterCompanies : [];
          seedFilter(); populateFilter();
        }
        var tc = (params.totalCount != null) ? params.totalCount : params.total_count;
        if (tc != null) state.totalCount = tc;
        if (params.totalCountInactive != null) state.totalCountInactive = params.totalCountInactive;
        var tbl = (params.table != null) ? params.table : (params.brands != null ? params.brands : params.rows);
        if (tbl != null){ state.tableRows = Array.isArray(tbl) ? tbl : []; state.hasTable = true; }
        if (params.inactive != null){
          state.inactiveRows = Array.isArray(params.inactive) ? params.inactive : [];
          if (state.totalCountInactive == null) state.totalCountInactive = state.inactiveRows.length;
        }
        if (params.series != null){
          var arr = Array.isArray(params.series) ? params.series : [];
          if (arr.length){
            state.series = arr; state.hasLine = true; state.linePending = false;
            clearTimeout(root.__uboNoDataT);
            applyGranAvailability(); seedFilter(); populateFilter();
          } else {
            clearTimeout(root.__uboNoDataT);
            root.__uboNoDataT = setTimeout(function(){
              if (state.hasLine && (state.series || []).length) return;
              if (isLoading()) return;
              state.hasLine = true; state.series = []; state.linePending = false;
              render();
            }, 600);
          }
        }
        if (!GRAN_PICKED[instanceId]){
          var g = params.granularity != null ? params.granularity : params.gran;
          g = String(g == null ? "" : g).toLowerCase().trim();
          var resolved = g.indexOf("month") === 0 ? "month" : g.indexOf("week") === 0 ? "week" : g.indexOf("day") === 0 ? "day" : null;
          if (resolved && resolved !== curGran){ curGran = resolved; GRAN_STORE[instanceId] = resolved; }
        }
        if (!LOADING_EXPLICIT[instanceId]) state.loading = readProcessing();
        render();
      },
      setInactive: function(rows){
        state.inactiveRows = Array.isArray(rows) ? rows : [];
        state.totalCountInactive = state.inactiveRows.length;
        if (state.status === "inactive"){ setHeadCount(); renderTable(); }
        return true;
      },
      setLoading: function(on){
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(on);
        render();
      },
      setTheme: function(on){
        var want = isYes(on);
        if (want === isDark) return;
        isDark = want;
        if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
        matrix.redraw();
        render();
      },
      destroy: function(){
        line.destroy(); matrix.destroy(); closeActMenu();
        if (root.__uboController === this) root.__uboController = null;
      }
    };
  }

  /* ================= mount ================= */
  var CACHE = (window.__uboCache = window.__uboCache || {});
  function cacheData(id, params){
    if (!id) return;
    CACHE[id] = CACHE[id] || {};
    CACHE[id].params = CACHE[id].params || {};
    for (var k in params){ if (params.hasOwnProperty(k) && params[k] !== undefined) CACHE[id].params[k] = params[k]; }
  }
  function applyCache(root, ctrl){
    var id = root.getAttribute("data-instance");
    if (!id || !CACHE[id]) return;
    if (CACHE[id].loading != null) ctrl.setLoading(CACHE[id].loading);
    if (CACHE[id].params) ctrl.update(CACHE[id].params);
  }
  function initRoot(root){
    if (!root) return null;
    if (root.__uboController) return root.__uboController;
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uboController = ctrl;
    applyCache(root, ctrl);
    return ctrl;
  }
  function resolve(id){
    var rs = mount.rootsWithId(id);
    return rs.length ? initRoot(rs[0]) : null;
  }

  function doRender(params){
    params = params || {};
    var id = params.instanceId || params.instance || null;
    cacheData(id, params);
    var roots = id ? mount.rootsWithId(id) : Array.prototype.slice.call(document.querySelectorAll(".ubo-root"));
    if (!roots.length){
      if (window.console) console.warn("[brands-overview] renderBrandsOverview: no .ubo-root matches instanceId " + JSON.stringify(id));
      return false;
    }
    roots.forEach(function(r){ var c = initRoot(r); if (c) c.update(params); });
    return true;
  }
  function doLoading(id, on){
    if (id){ CACHE[id] = CACHE[id] || {}; CACHE[id].loading = on; }
    var roots = id ? mount.rootsWithId(id) : Array.prototype.slice.call(document.querySelectorAll(".ubo-root"));
    roots.forEach(function(r){ var c = initRoot(r); if (c) c.setLoading(on); });
    return true;
  }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }
  function doTheme(id, on){ var c = resolve(id); if (!c) return false; c.setTheme(on); return true; }
  /* Inactive brands come from their OWN small RPC (company_id/name/favicon_url/deactivated_at),
     separate from the main visibility payload — same "fed in by its own Run-JS step" contract as
     every other secondary list in this app. Accepts a raw string too (Bubble's output is not valid
     JS), repaired by the one shared parser. */
  function doInactive(id, rows){
    var list = rows;
    if (typeof list === "string") list = UC.parseBubbleJson(list);
    if (!Array.isArray(list)) list = [];
    if (id){ CACHE[id] = CACHE[id] || {}; CACHE[id].params = CACHE[id].params || {}; CACHE[id].params.inactive = list; }
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".ubo-root"));
    if (!ctrl){
      if (window.console) console.warn("[brands-overview] setBrandsOverviewInactive: no .ubo-root matches instanceId " + JSON.stringify(id));
      return false;
    }
    return ctrl.setInactive(list);
  }

  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "ubo-root", notPortal: true,
    ctrlProp: "__uboController",
    resolveLocal: "__uboResolveLocal",
    queue: "__uboBootQueue",
    initRoot: initRoot,
    api: {
      renderBrandsOverview: doRender,
      setBrandsOverviewLoading: doLoading,
      resetBrandsOverview: doReset,
      setBrandsOverviewInactive: doInactive,
      setBrandsOverviewTheme: doTheme
    },
    forwardShape: { renderBrandsOverview: "params", resetBrandsOverview: "id" }
  });
  }

  uboBoot(50);
})();
