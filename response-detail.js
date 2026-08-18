/* upstreem response-detail.js — die Detailseite einer einzelnen Modellantwort.
   Braucht core.js (window.UpstreemCore).

   Vier Abschnitte in einer Wurzel, von oben:
     1. Der Prompt-Text als Titel, vollstaendig. Darunter Modell, Laufzeit und Market.
     2. "Mentions": welche verfolgten Marken in dieser Antwort vorkommen.
     3. "Full Response": der Antworttext selbst.
     4. "Citations": die Quellen, als Kacheln oder als Liste.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.respBody          der Antworttext samt Tabellen, Zitat-Chips und Markenauszeichnung
     UC.modelChip         Logo plus Anzeigename des Modells
     UC.marketChip        Flagge plus Laendercode
     UC.relativeTime      "2 minutes ago" / Datum
     UC.brandStack        die Marken-Chips einer URL, wie in jeder Tabelle
     UC.icon              jedes Icon
     UC.makeMount / makeFire / makeLate / parseLoose / widthTiers / onTheme / themeParam
     UC.makeTooltips      die Tooltips an allem, was data-tip traegt

   Neu ist hier nur, was es genau einmal gibt: der Aufbau der Seite, die zwei Ansichten der
   Quellen und das Menue, das ein Zitat-Chip oeffnet.

   Zu den drei Modellen: chatgpt, google-aio und perplexity schreiben ihre Zitate unterschiedlich
   ([Label](url), [0](url) mit Fussnotenliste, [(url)]). Diese Komponente kennt den Unterschied
   NICHT -- UC.respBody erkennt alle drei Formen am Text. Das Feld `model` fliesst nur in den
   Modell-Chip. Damit gibt es eine Fassung statt drei, und ein viertes Modell braucht keine neue. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setResponseDetail", "setResponseDetailLoading", "resetResponseDetail"];
  var Q = (window.__urdBootQueue = window.__urdBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function urdBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { urdBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    urdStart();
  }

  function urdStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;

  var VIEWS = [
    { key: "grid", label: "Grid", icon: "layoutGrid" },
    { key: "list", label: "List", icon: "listIcon" }
  ];
  /* Die Ansicht ueberlebt das Neueinspritzen des Markups durch Bubble -- sonst springt sie beim
     ersten Datenwechsel zurueck auf Grid. */
  var VIEW_STORE = (window.__urdView = window.__urdView || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  /* Spaltenzahl der Kachelansicht. Wie in responses-table wird nur eine Zahl gewaehlt, die die
     Kachelmenge glatt teilt -- sonst bleibt die letzte Reihe als Waise stehen (12 Quellen auf
     einer Breite fuer 5 Spalten ergaeben 5+5+2). */
  function spalten(breite, anzahl) {
    if (anzahl <= 1) return 1;
    var max = breite >= 1180 ? 4 : breite >= 880 ? 3 : breite >= 600 ? 2 : 1;
    if (max <= 1) return 1;
    for (var n = max; n >= 2; n--) if (anzahl % n === 0) return n;
    /* Keine glatte Teilung (Primzahl): dann die volle Breite nutzen und die kurze Reihe hinnehmen,
       aber nie mehr Spalten als Kacheln. */
    return Math.min(max, anzahl);
  }

  /* ============================================================================================
     Markup. Die Komponente baut ihren Innenaufbau selbst -- im Bubble-Element gibt es keine
     Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      '<div class="urd-head">' +
        /* role=button und tabindex, weil der Klick ein Ereignis feuert: ohne die zwei kann man den
           Titel mit der Tastatur nicht erreichen. */
        '<h2 class="urd-prompt" role="button" tabindex="0"></h2>' +
        '<div class="urd-kpis"></div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-ments">' +
        '<div class="urd-sec"><div class="urd-sec-txt">' +
          '<span class="urd-sec-title">Mentions</span>' +
          '<span class="urd-sec-desc">What tracked brands are mentioned in this response</span>' +
        '</div></div>' +
        '<div class="urd-card"><div class="urd-ments"></div></div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-body">' +
        '<div class="urd-sec"><div class="urd-sec-txt">' +
          '<span class="urd-sec-title">Full Response</span>' +
          '<span class="urd-sec-desc">The complete answer as the model returned it</span>' +
        '</div></div>' +
        '<div class="urd-card urd-body"><div class="up-rb"></div></div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-cites">' +
        '<div class="urd-sec">' +
          '<div class="urd-sec-txt">' +
            '<span class="urd-sec-title">Citations</span>' +
            '<span class="urd-sec-desc">What citations were used for this answer</span>' +
          '</div>' +
          '<div class="up-seg urd-viewseg" role="group" aria-label="Citations view">' +
            VIEWS.map(function (v) {
              return '<button class="up-seg-btn" type="button" data-view="' + v.key + '"' +
                       ' data-tip="' + esc(v.label) + '" aria-label="' + esc(v.label) + '">' +
                       UC.icon(v.icon, 2) + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +
        '<div class="urd-cites-grid"></div>' +
        '<div class="urd-cites-list"></div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__urdController) return root.__urdController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();
    var fire = UC.makeFire(root, { label: "response-detail", eventPrefix: "urd" });
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 640, vnarrowAt: 480 });
    /* Der zweite Parameter ist die Themenabfrage -- ohne ihn steht der Tooltip im Dunkeln hell. */
    if (UC.makeTooltips) UC.makeTooltips(root, function () { return isDark; });

    var elPrompt = root.querySelector(".urd-prompt");
    var elKpis   = root.querySelector(".urd-kpis");
    var elMents  = root.querySelector(".urd-ments");
    var elBody   = root.querySelector(".up-rb");
    var elGrid   = root.querySelector(".urd-cites-grid");
    var elList   = root.querySelector(".urd-cites-list");
    var elSeg    = root.querySelector(".urd-viewseg");

    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    var state = {
      view: VIEW_STORE[instanceId] || "grid",
      data: null, loading: false, hasData: false, error: null
    };

    /* ---- Ein Wartezustand, der endet -------------------------------------------------------
       Das Skelett laeuft, solange keine Daten da sind. Ohne Ende ist "kommt gleich" nicht von
       "kommt nie" zu unterscheiden -- dieselbe Uhr und dieselbe Dauer wie in brand-detail und
       domain-detail. Im UI steht dann "No data"; warum, sagt die Konsole. */
    var WARTE_MS = 25000, warteUhr = null;
    function warteStarten() {
      if (warteUhr) clearTimeout(warteUhr);
      warteUhr = setTimeout(function () {
        warteUhr = null;
        if (state.hasData || state.error) return;
        if (window.console) console.warn("[response-detail] " + WARTE_MS + "ms ohne " +
          'setResponseDetail fuer die Instanz "' + instanceId + '". Laeuft der Pageload-Workflow?');
        state.error = "No data";
        state.loading = false;
        render();
      }, WARTE_MS);
    }
    function warteBeenden() { if (warteUhr) { clearTimeout(warteUhr); warteUhr = null; } }
    warteStarten();

    /* ---- Das Menue eines Zitat-Chips ------------------------------------------------------
       Aus ask-mira uebernommen: "Open detail page" zuerst und fett, darunter die URL selbst.
       Es haengt an der Wurzel und nicht am Chip -- ein Chip steht auch in einer Tabellenzelle,
       die waagerecht scrollt, und ein Menue darin wuerde mitscrollen und abgeschnitten werden. */
    var pop = document.createElement("div");
    pop.className = "up-rb-pop";
    root.appendChild(pop);
    var popChip = null;

    function popZu() { if (popChip) { pop.classList.remove("is-open"); popChip = null; } }
    function popAuf(chip) {
      var url = chip.getAttribute("data-rb-cite") || "";
      var kurz = UC.rbShowUrl(url);
      if (kurz.length > 34) kurz = kurz.slice(0, 34) + "...";
      pop.innerHTML =
        '<button type="button" data-pop="detail" class="is-primary">' + UC.icon("fileText", 2) +
          "<span>Open detail page</span></button>" +
        '<button type="button" data-pop="visit">' + UC.icon("externalLink", 2) +
          "<span>" + esc(kurz) + "</span></button>";
      popChip = chip;
      pop.classList.add("is-open");
      var r = chip.getBoundingClientRect(), rr = root.getBoundingClientRect();
      pop.style.top = (r.bottom - rr.top + 6) + "px";
      pop.style.left = (r.left - rr.left) + "px";
      /* Erst messen, wenn das Menue steht: seine Breite haengt am Text der URL. */
      requestAnimationFrame(function () {
        var maxLeft = root.clientWidth - pop.offsetWidth - 8;
        var left = r.left - rr.left;
        if (left > maxLeft) pop.style.left = Math.max(8, maxLeft) + "px";
      });
    }
    pop.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button[data-pop]") : null;
      if (!btn || !popChip) return;
      var chip = popChip, art = btn.getAttribute("data-pop");
      popZu();
      if (art === "visit") {
        var u = chip.getAttribute("data-rb-cite");
        if (u) window.open(u, "_blank", "noopener");
        return;
      }
      /* Detailseite: die id der Quelle, blank wenn die Zitationsliste diese URL nicht kennt --
         dann kann Bubble nichts oeffnen, und das Ereignis bleibt aus statt leer zu feuern. */
      /* Dieselbe Regel wie bei den Quellenkarten: id wenn da, sonst die URL. */
      var wert = (chip.getAttribute("data-rb-id") || "").trim() ||
                 (chip.getAttribute("data-rb-cite") || "");
      if (wert) fire("data-url-fn", "urdUrl", wert);
    });
    document.addEventListener("click", function (e) {
      if (!popChip) return;
      if (e.target.closest && (e.target.closest(".up-rb-pop") || e.target.closest(".up-rb-cite"))) return;
      popZu();
    }, true);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") popZu(); });
    window.addEventListener("scroll", popZu, true);

    /* ---- Kopfzeile ------------------------------------------------------------------------- */
    function renderHead() {
      if (state.error) { elPrompt.textContent = ""; elKpis.innerHTML = ""; return; }
      if (istLaden() || !state.data) {
        elPrompt.innerHTML = '<span class="urd-sk urd-sk-prompt"></span>' +
                             '<span class="urd-sk urd-sk-prompt2"></span>';
        elKpis.innerHTML = '<span class="urd-sk urd-sk-kpi"></span>' +
                           '<span class="urd-sk urd-sk-kpi"></span>';
        return;
      }
      var d = state.data;
      /* textContent und nicht innerHTML: der Prompt ist Nutzertext und darf kein Markup tragen. */
      elPrompt.textContent = String(d.prompt_text || "");
      elPrompt.setAttribute("data-id", String(d.prompt_id || ""));

      var teile = [];
      if (d.model) teile.push(UC.modelChip(d.model, { full: true }));
      var zeit = UC.relativeTime(d.run_at);
      if (zeit) teile.push('<span class="urd-kpi-time" data-tip="' +
        esc(String(d.run_at || "")) + '">' + esc(zeit) + "</span>");
      if (d.market) teile.push(UC.marketChip(d.market));
      /* Die Themen der Frage, wenn sie mitkommen: dasselbe Bauteil wie in der Prompts-Tabelle. */
      if (isArr(d.tags) && d.tags.length) {
        teile.push('<span class="urd-tags">' + d.tags.map(function (t) {
          if (!t || !t.name) return "";
          return '<span class="up-tag">' +
            (t.emoji ? '<span class="up-tag-lbl">' + esc(t.emoji) + " </span>" : "") +
            '<span class="up-tag-lbl">' + esc(t.name) + "</span></span>";
        }).join("") + "</span>");
      }
      elKpis.innerHTML = teile.join("");
    }

    /* ---- Mentions ------------------------------------------------------------------------- */
    function renderMents() {
      if (state.error) { elMents.innerHTML = '<span class="urd-empty">' + esc(state.error) + "</span>"; return; }
      if (istLaden() || !state.data) {
        elMents.innerHTML = new Array(4).join("x").split("x")
          .map(function () { return '<span class="urd-sk urd-sk-ment"></span>'; }).join("");
        return;
      }
      var liste = isArr(state.data.companies) ? state.data.companies : [];
      if (!liste.length) {
        elMents.innerHTML = '<span class="urd-empty">No tracked brands mentioned in this response.</span>';
        return;
      }
      elMents.innerHTML = liste.map(function (c) {
        var name = String((c && c.name) || "");
        var logo = String((c && c.favicon_url) || "");
        var buchst = (name.charAt(0) || "?").toUpperCase();
        /* .up-entchip + .up-chiphover + .up-ment-logo + .up-ment-name sind alle aus core --
           hier entsteht kein eigenes Aussehen, nur die Zusammensetzung. */
        return '<span class="up-entchip up-chiphover urd-ment" role="button" tabindex="0"' +
                 ' data-brand="' + esc(String((c && c.company_id) || "")) + '">' +
                 '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
                   '<span class="up-model-ltr">' + esc(buchst) + "</span>" +
                   (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy"' +
                           ' referrerpolicy="no-referrer"' +
                           ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
                 "</span>" +
                 '<span class="up-ment-name">' + esc(name) + "</span>" +
               "</span>";
      }).join("");
    }

    /* ---- Full Response -------------------------------------------------------------------- */
    var letzteMessung = null;
    function renderBody() {
      if (state.error) { elBody.innerHTML = '<span class="urd-empty">' + esc(state.error) + "</span>"; return; }
      if (istLaden() || !state.data) {
        elBody.innerHTML = [72, 96, 88, 64, 92, 40].map(function (w) {
          return '<span class="urd-sk urd-sk-line" style="width:' + w + '%"></span>';
        }).join("");
        return;
      }
      var d = state.data;
      var text = d.response_json && d.response_json.text != null ? d.response_json.text : d.text;
      if (text == null || String(text).trim() === "") {
        elBody.innerHTML = '<span class="urd-empty">No response text.</span>';
        letzteMessung = null;
        return;
      }
      /* Der ganze Weg liegt in core: Bloecke, Tabellen, Zitat-Chips, Markenauszeichnung. Was
         gesetzt wurde, kommt zurueck -- damit ist es messbar statt geraten. */
      letzteMessung = UC.respBody(elBody, {
        text: text,
        citations: d.citations,
        companies: d.companies,
        model: d.model
      });
    }

    /* ---- Citations ------------------------------------------------------------------------ */
    function favOf(c) {
      if (c && c.favicon) return String(c.favicon);
      try { return "https://www.google.com/s2/favicons?domain=" + new URL(c.url).hostname + "&sz=128"; }
      catch (e) { return ""; }
    }
    function domainOf(c) {
      if (c && c.domain) return String(c.domain);
      try { return new URL(c.url).hostname.replace(/^www\./i, ""); } catch (e) { return ""; }
    }
    /* Ein Titel, der nur die URL wiederholt, ist kein Titel -- dann steht die Anzeigeform der URL
       da, die wenigstens lesbar ist. Kommt bei google.com/searchviewer-Quellen vor. */
    function titelOf(c) {
      var t = String((c && c.title) || "").trim();
      var u = String((c && c.url) || "").trim();
      if (!t || t === u) return UC.rbShowUrl(u);
      return t;
    }
    /* Die Beschreibungen der RPC tragen teils den Titel und angehaengte Rohdaten ("— title: ...").
       Der Teil ab dem Gedankenstrich mit "title:" dahinter ist Schrott und wird abgeschnitten. */
    function descOf(c) {
      var d = String((c && c.description) || "").trim();
      var i = d.indexOf("— title:");
      if (i > 0) d = d.slice(0, i).trim();
      return d;
    }

    /* Der Wert, den ein Klick auf eine Quelle nach Bubble traegt: die id, wenn die RPC eine
       mitschickt -- sonst die URL. In allen drei Beispiel-Payloads hat citations KEIN Feld id,
       also waere der Klick sonst wirkungslos. Die URL ist der einzige Schluessel, der in den
       Daten wirklich vorkommt, und sie ist eindeutig: Bubble findet damit dieselbe Zeile.
       Sobald die RPC eine id liefert, gewinnt sie automatisch. */
    function quellWert(c) {
      var id = String((c && c.id) || "").trim();
      return id || String((c && c.url) || "");
    }

    function renderCites() {
      var leer = state.error ? esc(state.error) : null;
      if (leer) { elGrid.innerHTML = '<span class="urd-empty">' + leer + "</span>"; elList.innerHTML = ""; return; }
      if (istLaden() || !state.data) {
        elGrid.innerHTML = "xxxx".split("").map(function () {
          return '<span class="urd-sk urd-sk-card"></span>';
        }).join("");
        elList.innerHTML = "";
        spaltenSetzen(4);
        return;
      }
      var liste = (isArr(state.data.citations) ? state.data.citations : []).filter(function (c) {
        return c && c.url;
      });
      if (!liste.length) {
        elGrid.innerHTML = '<span class="urd-empty">No citations for this response.</span>';
        elList.innerHTML = '<span class="urd-empty">No citations for this response.</span>';
        spaltenSetzen(1);
        return;
      }

      elGrid.innerHTML = liste.map(function (c) {
        var fav = favOf(c), dom = domainOf(c), desc = descOf(c);
        return '<div class="urd-cite-card" role="button" tabindex="0" data-url="' +
                 esc(quellWert(c)) + '" data-href="' + esc(String(c.url)) + '">' +
                 '<div class="urd-cc-head">' +
                   (fav ? '<img class="urd-cc-fav" src="' + esc(fav) + '" alt="" loading="lazy"' +
                          ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
                   '<span class="urd-cc-domain">' + esc(dom) + "</span>" +
                 "</div>" +
                 '<div class="urd-cc-title">' + esc(titelOf(c)) + "</div>" +
                 (desc ? '<div class="urd-cc-desc">' + esc(desc) + "</div>" : '<div class="urd-cc-desc"></div>') +
                 '<div class="urd-cc-foot">' + UC.brandStack(c.mentions) + "</div>" +
               "</div>";
      }).join("");

      elList.innerHTML = liste.map(function (c) {
        var fav = favOf(c);
        return '<div class="urd-cite-row" role="button" tabindex="0" data-url="' +
                 esc(quellWert(c)) + '" data-href="' + esc(String(c.url)) + '">' +
                 (fav ? '<img class="urd-cr-fav" src="' + esc(fav) + '" alt="" loading="lazy"' +
                        ' referrerpolicy="no-referrer" onerror="this.remove()"/>' : "") +
                 '<span class="urd-cr-txt">' +
                   '<span class="urd-cr-title">' + esc(titelOf(c)) + "</span>" +
                   '<span class="urd-cr-domain">' + esc(domainOf(c)) + "</span>" +
                 "</span>" +
                 '<span class="urd-cr-ments">' + UC.brandStack(c.mentions) + "</span>" +
               "</div>";
      }).join("");

      spaltenSetzen(liste.length);
    }

    function spaltenSetzen(anzahl) {
      var b = root.clientWidth || 0;
      if (!b) { setTimeout(function () { spaltenSetzen(anzahl); }, 100); return; }
      elGrid.style.setProperty("--urd-cols", String(spalten(b, anzahl)));
    }

    function syncSeg() {
      [].forEach.call(elSeg.querySelectorAll("[data-view]"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-view") === state.view);
      });
      root.classList.toggle("is-listview", state.view === "list");
    }

    function istLaden() { return !!state.loading; }

    function render() {
      syncSeg();
      renderHead();
      renderMents();
      renderBody();
      renderCites();
    }

    /* ---- Klicks --------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;

      var v = e.target.closest("[data-view]");
      if (v && elSeg.contains(v)) {
        var k = v.getAttribute("data-view");
        if (k === state.view) return;
        state.view = k; VIEW_STORE[instanceId] = k;
        syncSeg();
        /* Die Spaltenzahl haengt an der Kachelmenge und muss nach dem Umschalten neu stehen:
           im Listenmodus ist das Raster verborgen und meldet Breite 0. */
        if (k === "grid" && state.data) spaltenSetzen((state.data.citations || []).length);
        fire("data-view-fn", "urdView", { view: k });
        return;
      }

      /* Ein Zitat-Chip im Antworttext: Menue auf, oder zu, wenn es schon zu diesem Chip offen war. */
      var chip = e.target.closest(".up-rb-cite");
      if (chip && elBody.contains(chip)) {
        if (popChip === chip) popZu(); else popAuf(chip);
        return;
      }
      /* Eine Markenauszeichnung im Antworttext. */
      var bchip = e.target.closest(".up-rb-brand");
      if (bchip && elBody.contains(bchip)) {
        markeFeuern(bchip.getAttribute("data-rb-brand"));
        return;
      }
      /* Eine Marke im Mentions-Abschnitt. */
      var m = e.target.closest(".urd-ment");
      if (m) { markeFeuern(m.getAttribute("data-brand")); return; }
      /* Eine Quelle, als Kachel oder als Zeile. */
      var q = e.target.closest(".urd-cite-card, .urd-cite-row");
      if (q) { quelleFeuern(q); return; }
      /* Der Prompt-Titel. */
      if (e.target.closest(".urd-prompt")) {
        var pid = elPrompt.getAttribute("data-id") || "";
        if (pid) fire("data-prompt-fn", "urdPrompt", pid);
        return;
      }
    });

    /* Tastatur: was mit der Maus geht, muss auch mit Enter und Leertaste gehen -- role=button
       allein macht ein span noch nicht bedienbar. */
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
      var z = e.target.closest ? e.target.closest(
        ".urd-prompt, .urd-ment, .urd-cite-card, .urd-cite-row, .up-rb-cite, .up-rb-brand") : null;
      if (!z) return;
      e.preventDefault();
      z.click();
    });

    /* Die Werte sind blanke Zeichenketten, keine Objekte -- so ist es in der Aufgabe festgelegt
       und so liest Bubble sie ohne Umweg. */
    function markeFeuern(id) {
      if (id) fire("data-brand-fn", "urdBrand", id);
      else if (window.console) console.warn("[response-detail] Marke ohne company_id -- " +
        "kein Ereignis. Liefert die RPC company_id in companies mit?");
    }
    function quelleFeuern(el) {
      var wert = el.getAttribute("data-url") || "";
      if (wert) fire("data-url-fn", "urdUrl", wert);
    }

    /* ---- Thema ---------------------------------------------------------------------------- */
    if (UC.onTheme) UC.onTheme(function (dunkel) {
      isDark = !!dunkel;
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    });

    /* Die Spaltenzahl haengt an der Breite der eigenen Box. */
    if (UC.onResize) UC.onResize(root, function () {
      if (state.data && state.view === "grid") spaltenSetzen((state.data.citations || []).length);
      popZu();
    });

    render();

    var ctrl = {
      set: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "response-detail") : payload;
        /* Die RPC liefert eine Liste mit einem Eintrag (so sehen alle drei Beispiele aus). Ein
           blankes Objekt wird genauso genommen -- wer den Payload von Hand baut, soll nicht an
           einer Klammer scheitern. */
        if (isArr(p)) p = p.length ? p[0] : null;
        var ok = p && typeof p === "object" && (p.prompt_text != null || p.response_json || p.id);
        state.error = ok ? null : "The response data could not be read.";
        state.data = ok ? p : null;
        state.hasData = !!ok;
        state.loading = false;
        warteBeenden();
        render();
        return true;
      },
      setLoading: function (v) {
        state.loading = isYes(v);
        if (state.loading) warteStarten(); else warteBeenden();
        render();
        return true;
      },
      reset: function () {
        state.data = null; state.hasData = false; state.error = null; state.loading = false;
        state.view = "grid"; VIEW_STORE[instanceId] = "grid";
        warteBeenden();
        popZu();
        render();
        return true;
      }
    };
    root.__urdController = ctrl;
    if (spaet && spaet.drain) spaet.drain(instanceId, ctrl);
    return ctrl;
  }

  /* Aufrufe, deren Instanz noch nicht im Dokument steht, warten hier und werden nachgeholt --
     ohne das verpuffte ein Setter, der eine Sekunde zu frueh kam, still. */
  var spaet = UC.makeLate ? UC.makeLate("response-detail", ".urd-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "urd-root", notPortal: true,
    ctrlProp: "__urdController",
    resolveLocal: "__urdResolveLocal",
    queue: "__urdBootQueue",
    initRoot: initRoot,
    api: {
      setResponseDetail:        function (id, p) { return each(id, function (c) { c.set(p); }); },
      setResponseDetailLoading: function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetResponseDetail:      function (id)    { return each(id, function (c) { c.reset(); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, fn);
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  /* Bubble spritzt das Markup neu ein -- ohne das findet ein Setter nach dem Neuaufbau keine
     Wurzel mehr, weil die alte aus dem Dokument verschwunden ist. */
  if (UC.watchRoots) UC.watchRoots("urd-root", function () {
    [].forEach.call(document.querySelectorAll(".urd-root"), initRoot);
  });
  }

  urdBoot(30);
})();
