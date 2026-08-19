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
        /* Keine Karte um die Chips: sie tragen selbst schon einen Rahmen, und ein Rahmen im
           Rahmen liest sich als zwei Ebenen, wo es nur eine gibt. */
        '<div class="urd-ments"></div>' +
      '</div>' +

      '<div class="urd-sect urd-sect-body">' +
        '<div class="urd-sec">' +
          '<div class="urd-sec-txt">' +
            '<span class="urd-sec-title">Full Response</span>' +
            '<span class="urd-sec-desc">The complete answer as the model returned it</span>' +
          '</div>' +
          /* Der Knopf sitzt in der Zeile der Ueberschrift, nicht darunter -- .urd-sec ist schon
             eine Zeile mit space-between, der Platz rechts war frei.
             wrap + menu, wie UC.makePopover es erwartet: der Wrap traegt is-open, das Menue haengt
             darin und wird von core positioniert und geschlossen. */
          '<span class="urd-hlwrap">' +
            '<button class="up-iconbtn urd-hlbtn" type="button" data-tip="Highlights"' +
              ' aria-label="Highlight settings"></button>' +
            '<div class="urd-hlpop up-pop"></div>' +
          '</span>' +
        '</div>' +
        /* Der Antworttext liest sich wie eine Nachricht -- also bekommt er auch den Absender:
           links das Modell-Logo, daneben sein Name. Die Idee stammt aus den alten Elementen, dort
           war es ein loses Bild neben dem Kasten. */
        /* Logo und Karte auf einer Linie: das Logo steht neben der Karte wie ein Profilbild neben
           einer Nachricht, seine Oberkante auf der Oberkante der Karte. Der Modellname stand
           vorher darueber -- er steht schon in der KPI-Zeile oben, zweimal derselbe Name auf
           einer Seite. */
        '<div class="urd-msg">' +
          '<div class="urd-msg-av"></div>' +
          '<div class="urd-card urd-body"><div class="up-rb"></div></div>' +
        '</div>' +
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
    var elAv     = root.querySelector(".urd-msg-av");
    var elHlBtn  = root.querySelector(".urd-hlbtn");
    var elHlWrap = root.querySelector(".urd-hlwrap");
    var elHlPop  = root.querySelector(".urd-hlpop");
    var elGrid   = root.querySelector(".urd-cites-grid");
    var elList   = root.querySelector(".urd-cites-list");
    var elSeg    = root.querySelector(".urd-viewseg");

    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* Die Einstellungen der Hervorhebungen. Sie gelten fuer den Nutzer, nicht fuer die Instanz,
       also liegen sie in den Einstellungen (localStorage ueber UC.prefGet/prefSet, teambezogen) --
       wer sie einmal setzt, findet sie auf der naechsten Antwort wieder. */
    var HL_KEY = "urdHighlights";
    var HL_MODES = [
      { key: "all",   label: "All mentions",         desc: "Every time a brand appears" },
      { key: "first", label: "First mention only",   desc: "Once per brand" },
      { key: "own",   label: "Your brand only",      desc: "Competitors stay plain" },
      { key: "none",  label: "Off",                  desc: "No brand highlighting" }
    ];
    function hlLesen() {
      var v = null;
      try { v = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(HL_KEY) : HL_KEY) : null; } catch (e) {}
      var o = null;
      try { o = v ? JSON.parse(v) : null; } catch (e) { o = null; }
      var modus = o && o.brands;
      var gueltig = HL_MODES.some(function (m) { return m.key === modus; });
      return { brands: gueltig ? modus : "first", cites: !(o && o.cites === false),
               group: !!(o && o.group) };
    }
    function hlSchreiben() {
      try {
        if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(HL_KEY) : HL_KEY,
          JSON.stringify({ brands: state.hl.brands, cites: state.hl.cites, group: state.hl.group }));
      } catch (e) {}
    }

    var state = {
      view: VIEW_STORE[instanceId] || "grid",
      hl: hlLesen(),
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

    /* ---- Der Kasten, der die Quellen einer Gruppe auflistet ---------------------------------
       Auf Hover, nicht auf Klick: die Gruppe ist eine Zusammenfassung, und wer sie ueberfliegt,
       will wissen was drin ist, ohne etwas zu oeffnen. Ein Klick auf eine Zeile darin verhaelt sich
       wie der Klick auf einen einzelnen Chip. */
    var glist = document.createElement("div");
    glist.className = "up-rb-glist";
    root.appendChild(glist);
    var glistFuer = null, glistZu = null;

    function glistSchliessen() {
      if (glistZu) { clearTimeout(glistZu); glistZu = null; }
      glist.classList.remove("is-open");
      glistFuer = null;
    }
    function glistOeffnen(g) {
      var daten;
      try { daten = JSON.parse(g.getAttribute("data-rb-group") || "[]"); } catch (e) { daten = []; }
      if (!daten.length) return;
      glist.innerHTML = daten.map(function (d, i) {
        return '<button type="button" data-gi="' + i + '">' +
          (d.fav ? '<img src="' + esc(d.fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.style.visibility=\'hidden\'"/>' : '<img alt=""/>') +
          "<span>" + esc(d.title || UC.rbShowUrl(d.url)) + "</span></button>";
      }).join("");
      glist.__daten = daten;
      glistFuer = g;
      glist.classList.add("is-open");
      var r = g.getBoundingClientRect(), rr = root.getBoundingClientRect();
      glist.style.top = (r.bottom - rr.top + 6) + "px";
      glist.style.left = (r.left - rr.left) + "px";
      /* Erst nach dem Einfuegen messen: die Breite haengt am laengsten Titel. */
      requestAnimationFrame(function () {
        var maxLeft = root.clientWidth - glist.offsetWidth - 8;
        var left = r.left - rr.left;
        if (left > maxLeft) glist.style.left = Math.max(8, maxLeft) + "px";
      });
    }
    /* Verzoegertes Schliessen, damit der Weg von der Gruppe in den Kasten nicht abreisst. */
    function glistSpaeterSchliessen() {
      if (glistZu) clearTimeout(glistZu);
      glistZu = setTimeout(glistSchliessen, 180);
    }
    elBody.addEventListener("mouseover", function (e) {
      var g = e.target.closest ? e.target.closest(".up-rb-cgroup") : null;
      if (!g) return;
      if (glistZu) { clearTimeout(glistZu); glistZu = null; }
      if (glistFuer !== g) glistOeffnen(g);
    });
    elBody.addEventListener("mouseout", function (e) {
      var g = e.target.closest ? e.target.closest(".up-rb-cgroup") : null;
      if (g) glistSpaeterSchliessen();
    });
    glist.addEventListener("mouseover", function () { if (glistZu) { clearTimeout(glistZu); glistZu = null; } });
    glist.addEventListener("mouseout", glistSpaeterSchliessen);
    glist.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("button[data-gi]") : null;
      if (!b || !glist.__daten) return;
      var d = glist.__daten[parseInt(b.getAttribute("data-gi"), 10)];
      glistSchliessen();
      if (!d) return;
      var wert = String(d.id || "").trim() || d.url;
      if (wert) fire("data-url-fn", "urdUrl", wert);
    });
    window.addEventListener("scroll", glistSchliessen, true);

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
      if (isArr(d.tags) && d.tags.length) {
        teile.push('<span class="urd-tags">' + d.tags.map(topicChip).join("") + "</span>");
      }
      /* Ein Trenner zwischen den Angaben. Ohne ihn standen Modell, Zeit, Market und Themen als
         eine Reihe da und lasen sich als ein zusammenhaengender Satz. */
      elKpis.innerHTML = teile.join('<span class="urd-kpi-sep" aria-hidden="true"></span>');
    }

    /* Ein Thema als .up-topicchip aus core -- dasselbe Bauteil und dieselbe Farbe wie in der
       Prompts-Tabelle, im Radar und im Topics-Manager. Die Farbe steht NICHT im Payload: sie kommt
       aus dem seitenweiten Themen-Store, nachgeschlagen ueber die id. Fehlt der Store, bleibt der
       Chip beim Grau aus dem Bauteil -- lesbar, nur ohne Zuordnung.
       is-static, weil ein Thema hier reine Anzeige ist und keinen Klick traegt. */
    /* Die Farbe kommt jetzt im Payload mit: hex_light und hex_dark je Thema. Sie gewinnt, weil sie
       zu DIESER Antwort gehoert -- der Themen-Store kann veraltet sein oder auf der Seite fehlen.
       Nur wenn beide Felder fehlen, wird im Store nachgeschlagen; erst dann bleibt es beim Grau
       des Bauteils. */
    function topicFarbe(t) {
      if (!t) return "";
      var eigen = isDark ? t.hex_dark : t.hex_light;
      if (eigen) return String(eigen);
      /* Nur eine Farbe geliefert: die nehmen, statt in beiden Themen grau zu bleiben. */
      if (t.hex_light || t.hex_dark) return String(t.hex_light || t.hex_dark);
      var liste = UC.getTopics ? UC.getTopics() : null;
      if (!liste || !t.id) return "";
      for (var i = 0; i < liste.length; i++) {
        var x = liste[i];
        if (x && String(x.id) === String(t.id)) return String(x.color || "");
      }
      return "";
    }
    function topicChip(t) {
      if (!t || !t.name) return "";
      var farbe = topicFarbe(t);
      return '<span class="up-topicchip is-static"' +
               (farbe ? ' style="--ust-tag-color:' + esc(farbe) + '"' : "") + ">" +
               (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + "</span>" : "") +
               '<span class="up-topicchip-lbl">' + esc(t.name) + "</span>" +
             "</span>";
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
        /* Kein Chip und keine Karte: Logo und Name, wie in der Mentioned-Liste der Tabellen.
           Der Rahmen um jede Marke machte aus einer Aufzaehlung eine Reihe von Knoepfen -- hier
           steht aber einfach, wer vorkommt. Anklickbar bleibt es (der Zeiger und der Hover sagen
           es), nur ohne eigenen Kasten. */
        return '<span class="urd-ment" role="button" tabindex="0"' +
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
        model: d.model,
        brandMode: state.hl.brands,
        cites: state.hl.cites,
        groupCites: state.hl.group,
        ownIds: eigeneIds(d)
      });
    }

    /* Welche Marke ist die eigene? Das companies-Array sagt es nicht -- die Rolle steht nur an
       den Erwaehnungen der Zitationen (role: "own"). Von dort kommt die Menge der eigenen ids, und
       das ist der einzige Ort in den Daten, der es hergibt. */
    function eigeneIds(d) {
      var out = null;
      (isArr(d && d.citations) ? d.citations : []).forEach(function (c) {
        (isArr(c && c.mentions) ? c.mentions : []).forEach(function (m) {
          if (m && m.role === "own" && m.company_id) {
            if (!out) out = {};
            out[String(m.company_id)] = true;
          }
        });
      });
      return out;
    }

    /* Absender der Nachricht: Logo und Name des Modells, beides aus dem Modell-Store (UC.modelChip
       liefert genau das Paar). Der Chip wird auseinandergenommen, weil das Logo hier gross links
       neben der Karte steht und der Name darueber. */
    function renderAbsender() {
      if (istLaden() || !state.data || state.error) {
        elAv.innerHTML = '<span class="urd-sk urd-sk-av"></span>';
        elHlBtn.hidden = true;
        return;
      }
      elHlBtn.hidden = false;
      if (!elHlBtn.innerHTML) elHlBtn.innerHTML = UC.icon("settings", 2);
      /* Nur das Logo aus dem Modell-Chip -- den Namen traegt die KPI-Zeile oben. Der Tooltip
         nennt ihn trotzdem, damit das Bild allein nicht raten laesst. */
      var chip = document.createElement("div");
      chip.innerHTML = UC.modelChip(state.data.model, { full: true });
      var logo = chip.querySelector(".up-ment-logo");
      var name = chip.querySelector(".up-ment-name");
      elAv.innerHTML = logo ? logo.outerHTML : "";
      if (name) elAv.setAttribute("data-tip", name.textContent);
    }

    /* ---- Das Menue der Hervorhebungen (10) --------------------------------------------------
       Ein kleines Menue an der Kopfzeile der Antwort. UC.makePopover uebernimmt Positionierung,
       Schliessen bei Klick daneben und Escape -- dasselbe Verhalten wie jedes andere Menue der App. */
    function hlMenuHtml() {
      return '<div class="urd-hlgrp">' +
          '<div class="urd-hlhead">Brand highlights</div>' +
          HL_MODES.map(function (m) {
            return '<button type="button" class="urd-hlopt' +
              (state.hl.brands === m.key ? " is-on" : "") + '" data-hl="' + m.key + '">' +
              '<span class="urd-hlradio"></span>' +
              '<span class="urd-hltxt"><span class="urd-hllbl">' + esc(m.label) + "</span>" +
              '<span class="urd-hldesc">' + esc(m.desc) + "</span></span></button>";
          }).join("") +
        "</div>" +
        '<div class="urd-hlsep"></div>' +
        '<div class="urd-hlgrp">' +
          '<div class="urd-hlhead">Citations</div>' +
          '<button type="button" class="urd-hlopt" data-cites="1">' +
            '<span class="urd-hlcheck' + (state.hl.cites ? " is-on" : "") + '">' +
              UC.icon("check", 3) + "</span>" +
            '<span class="urd-hltxt"><span class="urd-hllbl">Show citation chips</span>' +
            '<span class="urd-hldesc">Sources stay listed below either way</span></span></button>' +
          /* Das Gruppieren hat nur einen Sinn, wenn die Chips ueberhaupt da sind. */
          '<button type="button" class="urd-hlopt' + (state.hl.cites ? "" : " is-off") +
            '" data-group="1"' + (state.hl.cites ? "" : " disabled") + ">" +
            '<span class="urd-hlcheck' + (state.hl.group && state.hl.cites ? " is-on" : "") + '">' +
              UC.icon("check", 3) + "</span>" +
            '<span class="urd-hltxt"><span class="urd-hllbl">Group adjacent sources</span>' +
            '<span class="urd-hldesc">Several in a row become one chip</span></span></button>' +
        "</div>";
    }
    var hlPop = UC.makePopover ? UC.makePopover({
      wrap: elHlWrap, menu: elHlPop, opener: elHlBtn
    }) : null;
    if (hlPop) {
      elHlBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        elHlPop.innerHTML = hlMenuHtml();
        hlPop.toggle();
      });
      elHlPop.addEventListener("click", function (e) {
        var opt = e.target.closest ? e.target.closest("[data-hl]") : null;
        if (opt) {
          state.hl.brands = opt.getAttribute("data-hl");
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
          return;
        }
        var cb = e.target.closest ? e.target.closest("[data-cites]") : null;
        if (cb) {
          state.hl.cites = !state.hl.cites;
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
          return;
        }
        var gb = e.target.closest ? e.target.closest("[data-group]") : null;
        if (gb && !gb.disabled) {
          state.hl.group = !state.hl.group;
          hlSchreiben();
          elHlPop.innerHTML = hlMenuHtml();
          renderBody();
        }
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
                 '<div class="urd-cc-foot">' + UC.brandStack(c.mentions, null, { max: 12 }) + "</div>" +
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
      markenPassen();
    }

    /* Die Marken im Fuss einer Kachel: so viele, wie neben dem freien Rand Platz haben, der Rest
       als "+N". UC.stackFit misst das nach dem Einfuegen -- vorher stehen die echten Breiten nicht
       fest, und sie haengen an der Spaltenzahl, die selbst an der Breite haengt.
       32px bleiben links frei (Vorgabe), damit die Chips nicht bis an die Kante des Titels
       darueber heranlaufen. */
    var MARKEN_RESERVE = 32;
    function markenPassen() {
      if (!UC.stackFit) return;
      [].forEach.call(elGrid.querySelectorAll(".urd-cc-foot .up-stack"), function (st) {
        UC.stackFit(st, { reserve: MARKEN_RESERVE });
      });
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
      renderAbsender();
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
        if (k === "grid" && state.data) { spaltenSetzen((state.data.citations || []).length); markenPassen(); }
        fire("data-view-fn", "urdView", { view: k });
        return;
      }

      /* Ein Zitat-Chip im Antworttext: Menue auf, oder zu, wenn es schon zu diesem Chip offen war. */
      var chip = e.target.closest(".up-rb-cite");
      if (chip && elBody.contains(chip)) {
        if (popChip === chip) popZu(); else popAuf(chip);
        return;
      }
      /* Eine Gruppe mehrerer Quellen: Klick oeffnet ihre Liste (auf dem Telefon gibt es kein
         Hover, dort ist der Klick der einzige Weg hinein). */
      var g = e.target.closest(".up-rb-cgroup");
      if (g && elBody.contains(g)) {
        if (glistFuer === g) glistSchliessen(); else glistOeffnen(g);
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
        ".urd-prompt, .urd-ment, .urd-cite-card, .urd-cite-row, .up-rb-cite, .up-rb-brand, " +
        ".up-rb-cgroup") : null;
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
      /* Die Themen-Chips tragen ihre Farbe als Inline-Wert (hex_light gegen hex_dark) -- die kann
         die Kaskade nicht umschalten, also muss die Zeile neu gebaut werden. */
      if (state.data) renderHead();
    });

    /* Die Spaltenzahl haengt an der Breite der eigenen Box. */
    if (UC.onResize) UC.onResize(root, function () {
      if (state.data && state.view === "grid") { spaltenSetzen((state.data.citations || []).length); markenPassen(); }
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
