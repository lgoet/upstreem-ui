/* upstreem filter-bar.js — die Filterleiste "More Filters" (Praefix ufb). Braucht core.js zuerst.

   ── Was sie ist ─────────────────────────────────────────────────────────────
   EIN Knopf statt vier dauerhaft sichtbarer Filter-Dropdowns. Der Datumsfilter bleibt daneben
   stehen (eigenes Element, wird hier nicht angefasst); Topics, Models und Markets ziehen in ein
   Dropdown, dessen Zeilen die BESTEHENDEN Filter-Dropdowns seitlich herausfahren lassen.

   ── Was sie NICHT ist ───────────────────────────────────────────────────────
   Sie baut keinen Filter nach. Kein Auswaehlen, kein Abwaehlen, keine Liste, kein Suchfeld, keine
   Sortierung, kein Match-Modus, kein einziges Bubble-Ereignis eines Filters. Das alles steht in
   filters/topics-filter.js, models-filter.js und markets-filter.js und bleibt dort.
   Diese Komponente ZIEHT die vorhandenen Wurzeln in ihr Untermenue ein und liest ihren Zustand.

   ── Wie das Einziehen funktioniert ──────────────────────────────────────────
   Die drei Filter sind eigene Bubble-Elemente irgendwo auf der Seite. Hier werden ihre Wurzeln
   per appendChild in das jeweilige Untermenue verschoben. Danach gilt:

     - Ihr eigener Trigger ist weg (CSS). Meine Zeile IST der Trigger.
     - Ihr Panel steht im Fluss statt absolut an einem Trigger, den es nicht mehr gibt (CSS).
     - Ihr innerer Zustand `open` bleibt auf false und wird NICHT angefasst. Das ist Absicht:
       ihr document-Zuhoerer, ihr Escape-Weg, ihr .is-right-Umklappen und ihre Anmeldung bei
       UC.dropdownOpened haengen alle daran, und jede davon wuerde hier gegen mein Panel arbeiten.
       Sichtbar ist ihr Panel, weil MEIN Untermenue offen ist -- eine Sichtbarkeit, nicht zwei.
     - Ihre Suche wird beim Verlassen ueber ihren EIGENEN Clear-Knopf geleert. Kein Zugriff auf
       ihren Zustand, nur ein Klick auf ein Bedienelement, das der Nutzer auch selbst treffen kann.

   ── Woher der Zustand kommt ─────────────────────────────────────────────────
   Nichts davon wird geraten oder nachgerechnet:

     Zeile im Panel   das INNERE ihres Triggers, woertlich gespiegelt (ohne dessen Chevron). Damit
                      steht dort genau das, was am Trigger stuende -- ein Themenname mit seinem
                      farbigen Punkt bei genau einer Auswahl, die Beschriftung mit dem
                      Zaehler-Badge ab zwei. Kein zweiter Renderer, der abweichen koennte.
     Auswahl          root.__utfCtrl.getSelected() (bzw. __umfCtrl / __umkCtrl) -- die oeffentliche
                      Auskunft der Filter.
     Namen fuer Chips die angehakten Zeilen ihrer eigenen Liste (.up-filter-item.is-checked).
                      Sie tragen die Namen bereits in der Sprache, in der sie auf dem Bildschirm
                      stehen; eine zweite Aufloesung ueber die Stores waere eine zweite Wahrheit.
     Wann neu lesen   ihre eigenen DOM-Ereignisse. Alle drei Filter senden schon eines mit dem
                      vollen Zustand: utf-topics, umf-models, umk-markets, aufsteigend am Root.
                      Dafuer musste an den Filtern nichts geaendert werden.

   ── Das einzige Ereignis dieser Komponente ──────────────────────────────────
     ufbReset   Reset Filters im Panel ODER Clear All in der Leiste. Beide leeren vorher die
                Auswahl JEDES eingezogenen Filters ueber dessen setSelected("") -- das ist der
                stille Weg (die Filter schicken dann nichts), damit nicht drei Ereignisse und
                dieses vierte gleichzeitig dieselbe Abfrage neu anstossen.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Panel-Schale      .up-menu + UC.makePopover
     Untermenue        .up-subwrap / .up-submenu + UC.makeSubmenu (Bruecke, Umklappen, Hineingehen)
     Zeilenform        .up-optrow
     leiser Trigger    .up-quietbtn
     Hinweispunkt      .up-badge.is-dot
     Chip              .up-entchip.is-static
     Zeichen           UC.icon
     Bubble-Klempnerei UC.makeFire / UC.makeLate */
(function () {
  "use strict";

  var API_NAMES = ["resetFilterBar", "setFilterBarTheme"];
  var Q = (window.__ufbBootQueue = window.__ufbBootQueue || []);
  if (!window.__ufbBootStubbed) {
    window.__ufbBootStubbed = true;
    API_NAMES.forEach(function (n) {
      if (typeof window[n] !== "function") window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
    });
  }

  /* Die drei Filter, in der vorgegebenen Reihenfolge. Alles, was diese Komponente ueber einen
     Filter wissen muss, steht in EINER Zeile -- ein vierter Filter ist damit ein Eintrag hier und
     sonst nichts.
       attr      Attribut am Root dieser Komponente, in dem die Instanz-Id des Filters steht
       rootSel   Klasse der Filterwurzel
       ctrl      Eigenschaft, unter der der Filter seinen Controller ablegt
       selKey    Feld in getSelected(), das die Auswahl als CSV traegt
       optSel    die angehakte Zeile seiner Liste
       nameSel   der Name darin
       evt       sein aufsteigendes DOM-Ereignis
       chip      Beschriftung des Chips, Einzahl -- "Topic: Leadgen" liest sich als eine Aussage
                 ueber diesen einen Filter, "Topics: Leadgen" als eine Liste, die zufaellig eins
                 lang ist */
  var FILTERS = [
    { key: "topics",  label: "Topics",  attr: "data-topics-instance",  rootSel: ".utf-root",
      ctrl: "__utfCtrl", selKey: "topic_ids",    opt: ".utf-opt", keyAttr: "data-id",
      nameSel: ".utf-opt-name", evt: "utf-topics",  chip: "Topic" },
    { key: "models",  label: "Models",  attr: "data-models-instance",  rootSel: ".umf-root",
      ctrl: "__umfCtrl", selKey: "model_keys",   opt: ".umf-opt", keyAttr: "data-key",
      nameSel: ".umf-opt-name", evt: "umf-models",  chip: "Model" },
    { key: "markets", label: "Markets", attr: "data-markets-instance", rootSel: ".umk-root",
      ctrl: "__umkCtrl", selKey: "market_codes", opt: ".umk-opt", keyAttr: "data-key",
      nameSel: ".umk-opt-name", evt: "umk-markets", chip: "Market" }
  ];
  /* Wie viele Namen ein Chip zeigt, bevor er auf "+N" zusammenfasst. Zwei: bei drei Namen ist der
     Chip breiter als der Knopf davor, und dann liest man die Leiste nicht mehr, sondern buchstabiert
     sie. */
  var CHIP_NAMEN = 2;
  /* Unter dieser SEITENbreite bricht die Leiste um und das Untermenue geht hinein statt heraus.
     768 ist die Grenze, die core in widthTiers ebenfalls als "schmal" benutzt. */
  var SCHMAL = 768;

  function ufbBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { ufbBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[filter-bar] UpstreemCore (core.js) not loaded");
      return;
    }
    ufbRun();
  }

  function ufbRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["makeSubmenu", "makePopover", "makeFire", "icon", "esc", "aufResize", "getPageWidth"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[filter-bar] Die core.js auf dieser Seite ist AELTER als filter-bar.js, es " +
        "fehlen: " + MISSING.join(", ") + ". Alle Elemente der Seite auf denselben Commit pinnen.");
    }

    var spaet = UC.makeLate ? UC.makeLate("filter-bar", ".ufb-root") : null;
    var CTRLS = [];

    function initRoot(root) {
      if (root.__ufbCtrl) return root.__ufbCtrl;
      root.classList.add("ufb-root");
      var instanceId = String(root.getAttribute("data-instance") || "").trim() || "default";

      /* Welche Filter sind auf dieser Seite ueberhaupt vorgesehen? Die Id steht im Attribut. Ein
         leeres Attribut oder ein stehengebliebener Platzhalter heisst: diesen Filter gibt es hier
         nicht -- dann gibt es auch keine Zeile dafuer. Genau das meinte die Vorgabe mit
         "erkennt automatisch, was an Filtern da ist". */
      function gewuenscht() {
        return FILTERS.filter(function (f) {
          var v = String(root.getAttribute(f.attr) || "").trim();
          return !!v && !/^[A-Z_]{3,}$/.test(v);
        });
      }
      function idVon(f) { return String(root.getAttribute(f.attr) || "").trim(); }
      /* Die Wurzel eines Filters auf der Seite finden. Exakt ODER als Praefix -- dieselbe Regel,
         nach der die Filter selbst ihre Instanzen aufloesen (mehrere Platzierungen einer Ansicht
         tragen dort "topics_dash", "topics_dash_2", ...). */
      function findeWurzel(f) {
        var id = idVon(f);
        if (!id) return null;
        var alle = document.querySelectorAll(f.rootSel);
        var i, r, rid;
        for (i = 0; i < alle.length; i++) {
          rid = String(alle[i].getAttribute("data-instance") || "");
          if (rid === id) return alle[i];
        }
        for (i = 0; i < alle.length; i++) {
          rid = String(alle[i].getAttribute("data-instance") || "");
          if (rid && rid.indexOf(id) === 0) return alle[i];
        }
        return null;
      }

      var liste = gewuenscht();

      root.innerHTML =
        '<div class="ufb-bar">' +
          '<span class="ufb-more">' +
            '<button class="up-quietbtn ufb-btn" type="button" aria-haspopup="menu" aria-expanded="false">' +
              UC.icon("listFilter", 2) + '<span class="ufb-btn-lbl">More Filters</span>' +
              /* EXAKT das Bauteil der Icon-Trigger in den Werkzeugleisten. Keine Zahl darin: sie
                 waere die Summe aus Themen, Modellen und Maerkten und beantwortet nichts. */
              '<span class="up-badge is-dot ufb-dot"></span>' +
            '</button>' +
            '<div class="up-menu ufb-menu" role="menu" aria-hidden="true">' +
              /* Die Zurueck-Zeile gehoert nach OBEN und gibt es nur im Hineingehen -- core
                 blendet sie ueber .is-drill.is-inside ein. */
              '<button class="up-optrow up-subback ufb-row" type="button">' +
                UC.icon("chevronLeft", 2) + '<span class="ufb-back-lbl">Back</span>' +
              '</button>' +
              '<div class="ufb-rows"></div>' +
              '<div class="ufb-div"></div>' +
              '<button class="up-optrow ufb-reset" type="button" data-ufb-reset>' +
                '<span>Reset Filters</span>' +
                '<span class="ufb-reset-x">' + UC.icon("x", 2.2) + '</span>' +
              '</button>' +
            '</div>' +
          '</span>' +
          '<span class="ufb-sep" aria-hidden="true"></span>' +
          '<span class="ufb-chips"></span>' +
          '<button class="ufb-clear" type="button" data-ufb-clear>Clear All</button>' +
        '</div>';

      var elBtn   = root.querySelector(".ufb-btn");
      var elMenu  = root.querySelector(".ufb-menu");
      var elMore  = root.querySelector(".ufb-more");
      var elRows  = root.querySelector(".ufb-rows");
      var elChips = root.querySelector(".ufb-chips");
      var elDot   = root.querySelector(".ufb-dot");

      var fire = UC.makeFire(root, { label: "filter-bar", eventPrefix: "ufb" });
      function isDark() {
        return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark";
      }
      if (UC.makeTooltips) UC.makeTooltips(root, isDark);

      /* ---------------- die Zeilen ----------------
         Eine Zeile je vorgesehenem Filter, in der Reihenfolge von FILTERS. Der Spiegel ist leer
         und wird aus dem Trigger des Filters gefuellt, sobald er eingezogen ist. */
      function zeilenBauen() {
        elRows.innerHTML = liste.map(function (f) {
          return '<div class="up-subwrap ufb-wrap" data-sub="' + esc(f.key) + '">' +
                   '<button class="up-optrow ufb-row up-subrow" type="button" aria-expanded="false" ' +
                     'aria-haspopup="menu">' +
                     '<span class="ufb-mirror" data-mirror>' +
                       '<span class="ufb-mirror-fallback">' + esc(f.label) + '</span>' +
                     '</span>' +
                     '<span class="ufb-caret">' + UC.icon("chevronRight", 2) + '</span>' +
                   '</button>' +
                   '<div class="up-submenu ufb-sub" data-sub-host="' + esc(f.key) + '"></div>' +
                 '</div>';
        }).join("");
        /* Der Hinweis steht IMMER im Markup und wird ueber eine Klasse gezeigt: er greift nicht nur
           bei "kein Filter eingetragen", sondern auch bei "eingetragen, aber keiner erreichbar"
           (Element noch nicht da, oder es haengt schon in einer anderen Leiste). Ein Panel, das
           ohne Grund leer aufgeht, ist der Zustand, den es hier nicht geben soll. */
        elRows.insertAdjacentHTML("beforeend",
          '<div class="up-empty-mini ufb-empty">' +
            (liste.length ? "These filters are not on this page yet" : "No filters on this page") +
          '</div>');
      }
      zeilenBauen();

      /* ---------------- Einziehen ----------------
         Wiederholbar mit Absicht: Bubble baut die Filterelemente nach einem Rerender neu auf, und
         dann steht die alte Wurzel nicht mehr im Dokument. Der Lauf holt sie dann erneut.
         Ein Filter, der (noch) nicht da ist, bekommt keine Zeile -- eine Zeile, die auf ein leeres
         Untermenue fuehrt, ist die schlechtere Auskunft. */
      var eingezogen = {};
      var geklagt = {};
      function einziehen() {
        var etwasNeu = false;
        liste.forEach(function (f) {
          var host = elRows.querySelector('[data-sub-host="' + f.key + '"]');
          if (!host) return;
          var da = eingezogen[f.key];
          if (da && document.contains(da) && da.parentNode === host) return;   /* steht schon */
          var w = findeWurzel(f);
          if (!w) return;
          /* Eine Filterwurzel ist EIN Knoten und kann nur an einer Stelle stehen. Liegt sie schon
             in der Leiste eines anderen Elements, wird sie NICHT weggenommen -- gemessen, als ich
             eine zweite Leiste auf dieselben Instanz-Ids zeigen liess: die zweite zog Topics und
             Markets zu sich, und in der ersten standen die Zeilen danach leer. Ein stiller
             Diebstahl ist der schlechteste Ausgang, also wird er verweigert und benannt. */
          if (w.__ufbHost && w.__ufbHost !== root && document.contains(w.__ufbHost)){
            if (!geklagt[f.key]){
              geklagt[f.key] = true;
              if (window.console) console.warn("[filter-bar] " + instanceId + ": der " + f.label +
                "-Filter \"" + idVon(f) + "\" liegt schon in der Leiste \"" +
                (w.__ufbHost.getAttribute("data-instance") || "?") + "\". Ein Filter-Dropdown kann " +
                "nur in EINER Leiste stehen. Gib dieser Leiste eine eigene Instanz-Id oder lass " +
                "das Attribut hier leer.");
            }
            return;
          }
          w.__ufbHost = root;
          host.appendChild(w);
          eingezogen[f.key] = w;
          etwasNeu = true;
          spiegelBeobachten(f, w);
        });
        var sichtbar = 0;
        liste.forEach(function (f) {
          var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
          if (!wrap) return;
          var leer = !eingezogen[f.key];
          wrap.classList.toggle("is-leer", leer);
          if (!leer) sichtbar++;
        });
        elRows.classList.toggle("is-empty", sichtbar === 0);
        if (etwasNeu) { spiegelnAlle(); render(); }
      }

      /* Der Spiegel: das Innere des Triggers, ohne dessen Chevron. Woertlich uebernommen und nicht
         nachgebaut -- der Filter rendert dort schon "Punkt + Name" bei einer Auswahl und
         "Beschriftung + Zaehler" ab zwei, und das soll in der Zeile genauso stehen. */
      function spiegeln(f) {
        var w = eingezogen[f.key];
        var wrap = elRows.querySelector('.up-subwrap[data-sub="' + f.key + '"]');
        var ziel = wrap && wrap.querySelector("[data-mirror]");
        if (!ziel) return;
        var trig = w && w.querySelector(".utf-trigger, .umf-trigger, .umk-trigger");
        if (!trig) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(f.label) + "</span>"; return; }
        var teile = [];
        Array.prototype.forEach.call(trig.children, function (c) {
          /* Ihr eigener Chevron bleibt draussen: die Zeile hat ihren eigenen, und der zeigt nach
             rechts (dort kommt das Untermenue heraus) und nicht nach unten. */
          if (c.classList && (c.classList.contains("utf-chev") || c.classList.contains("umf-chev") ||
                              c.classList.contains("umk-chev"))) return;
          teile.push(c.cloneNode(true));
        });
        ziel.innerHTML = "";
        if (!teile.length) { ziel.innerHTML = '<span class="ufb-mirror-fallback">' + esc(f.label) + "</span>"; return; }
        teile.forEach(function (t) { ziel.appendChild(t); });
      }
      function spiegelnAlle() { liste.forEach(spiegeln); }

      /* Der Trigger aendert sich, wenn der Nutzer im Filter etwas anhakt -- der Filter rendert ihn
         dann neu. Ein Beobachter je Filter statt eines Pollings. */
      function spiegelBeobachten(f, w) {
        if (!window.MutationObserver || w.__ufbObs) return;
        var trig = w.querySelector(".utf-trigger, .umf-trigger, .umk-trigger");
        if (!trig) return;
        w.__ufbObs = new MutationObserver(function () { spiegeln(f); render(); });
        w.__ufbObs.observe(trig, { childList: true, subtree: true, characterData: true,
                                   attributes: true, attributeFilter: ["class", "style"] });
      }

      /* ---------------- Zustand lesen ----------------
         Ausschliesslich ueber die oeffentliche Auskunft der Filter. Kein Nachrechnen, kein
         Nachhalten -- was der Filter sagt, gilt. */
      function auswahl(f) {
        var w = eingezogen[f.key];
        var c = w && w[f.ctrl];
        if (!c || typeof c.getSelected !== "function") return [];
        var s = null;
        try { s = c.getSelected(); } catch (e) { return []; }
        var csv = s && s[f.selKey] != null ? String(s[f.selKey]) : "";
        return csv.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      }
      /* Die Namen: je gewaehlter Schluessel die passende Zeile seiner eigenen Liste nachschlagen.
         Ueber den SCHLUESSEL und nicht ueber die Klasse is-checked -- die Reihenfolge folgt damit
         der Auswahl des Nutzers, und eine Liste, die gerade neu gerendert wird, kann nicht
         dazwischenfunken.
         Findet sich keine Zeile (Daten noch unterwegs, oder ein gespeicherter Filter zeigt auf
         einen Eintrag, den es nicht mehr gibt), bleibt der ROHE Schluessel stehen. Der sagt
         immer noch, WAS gefiltert wird -- "Model: gpt-4o" ist eine Auskunft, eine Zahl waere
         keine. Leer und unbekannt sind zwei Dinge. */
      function namen(f) {
        var w = eingezogen[f.key];
        var ids = auswahl(f);
        if (!w) return ids;
        return ids.map(function (id) {
          var sel = f.opt + '[' + f.keyAttr + '="' + cssEsc(id) + '"]';
          var row = null;
          try { row = w.querySelector(sel); } catch (e) {}
          var n = row && row.querySelector(f.nameSel);
          var t = n ? String(n.textContent || "").trim() : "";
          return t || id;
        });
      }
      /* Schluessel koennen Zeichen enthalten, die in einem Attributselektor Syntax sind. */
      function cssEsc(v) {
        var t = String(v == null ? "" : v);
        if (window.CSS && CSS.escape) return CSS.escape(t);
        return t.replace(/["\\]/g, "\\$&");
      }
      function aktiv() { return liste.filter(function (f) { return auswahl(f).length > 0; }); }

      /* ---------------- Chips ---------------- */
      function chipText(f) {
        var ids = auswahl(f);
        if (!ids.length) return null;
        var nm = namen(f).filter(Boolean);
        var wert;
        if (!nm.length) {
          /* Kann eigentlich nicht mehr vorkommen -- namen() faellt auf den rohen Schluessel
             zurueck. Bleibt als Netz: eine Zahl ist besser als ein leerer Chip. */
          wert = String(ids.length);
        } else if (nm.length <= CHIP_NAMEN) {
          wert = nm.join(", ");
        } else {
          wert = nm.slice(0, CHIP_NAMEN).join(", ") + ", +" + (nm.length - CHIP_NAMEN);
        }
        return { key: f.chip, wert: wert };
      }
      function renderChips() {
        var teile = [];
        liste.forEach(function (f) {
          var c = chipText(f);
          if (!c) return;
          teile.push('<span class="up-entchip is-static ufb-chip">' +
            '<span class="ufb-chip-lbl"><span class="ufb-chip-key">' + esc(c.key) + ': </span>' +
            esc(c.wert) + '</span></span>');
        });
        elChips.innerHTML = teile.join("");
      }

      /* EINE Entscheidung fuer beide Dinge, die von der Seitenbreite abhaengen: bricht die Leiste
         um, und geht das Untermenue hinein statt heraus. Sie steht hier und wird an
         UC.makeSubmenu durchgegeben (cfg.drill) -- zwei Rechnungen aus derselben Zahl laufen
         auseinander, und beim Messen war genau das der Fall: der Kit rechnete mit seiner eigenen
         Kopie von getPageWidth und blieb im Herausfahren, waehrend die Leiste schon umgebrochen
         war. Gemessen an der SEITENbreite und nicht an der eigenen: dieses Element ist in einer
         Werkzeugzeile ohnehin schmal, die Frage ist, wie viel Platz die Seite hat. */
      function schmal() { return UC.getPageWidth() < SCHMAL; }

      /* ---------------- render ---------------- */
      function render() {
        var an = aktiv().length > 0;
        root.classList.toggle("has-filters", an);
        /* Der Punkt: genau die Mechanik der Werkzeugleisten -- is-visible an .up-badge. */
        elDot.classList.toggle("is-visible", an);
        renderChips();
        var eng = schmal();
        root.classList.toggle("is-wrap", eng);
        /* is-drill setzt auch UC.makeSubmenu -- hier noch einmal, damit die Klasse auch dann
           stimmt, wenn das Panel noch nie offen war. Derselbe Wert aus derselben Funktion. */
        elMenu.classList.toggle("is-drill", eng);
        if (sub) sub.sync();
      }

      /* ---------------- Panel ---------------- */
      var pop = UC.makePopover({
        wrap: elMore, menu: elMenu, opener: elBtn, group: "ufb-" + instanceId,
        /* makePopover setzt aria-hidden am Menue, aber nicht aria-expanded am Knopf -- das
           gehoert dem Aufrufer, weil nur er weiss, welches Element der Ausloeser ist. */
        onClose: function () { sub.close(); elBtn.setAttribute("aria-expanded", "false"); }
      });
      elBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pop.isOpen()) { pop.close(false); return; }
        einziehen();
        spiegelnAlle();
        render();
        pop.open();
        /* Kippt an der rechten Fensterkante auf rechts ausgerichtet. Einmal beim Oeffnen, nicht
           beim Scrollen: das Panel ist absolut und wandert mit seinem Knopf mit. */
        elMenu.classList.remove("is-right");
        var r = elMenu.getBoundingClientRect();
        var vw = window.innerWidth || document.documentElement.clientWidth || 0;
        if (r.right > vw - 8) elMenu.classList.add("is-right");
        elBtn.setAttribute("aria-expanded", "true");
      });

      /* ---------------- Untermenue ----------------
         Verweildauer, Feststellen per Klick, Umklappen und das Hineingehen auf schmalen Seiten
         kommen komplett aus UC.makeSubmenu. */
      var sub = UC.makeSubmenu({
        panel: elMenu, rowSel: ".up-subwrap", keyAttr: "data-sub", drill: schmal,
        onOpen: function (key) {
          var f = byKey(key);
          if (f) spiegeln(f);
        },
        onClose: function (key) {
          /* Die Suche des Filters beim Verlassen leeren -- ueber SEINEN eigenen Clear-Knopf, nicht
             ueber seinen Zustand. Ein Suchtext, der beim naechsten Oeffnen noch drinsteht, sieht
             aus wie eine Liste, in der Eintraege fehlen. */
          var f = byKey(key);
          var w = f && eingezogen[f.key];
          if (!w) return;
          var x = w.querySelector(".utf-search-x, .umf-search-x, .umk-search-x");
          var feld = w.querySelector(".utf-search-in, .umf-search-in, .umk-search-in");
          if (x && feld && String(feld.value || "")) { try { x.click(); } catch (e) {} }
        }
      });
      function byKey(k) { for (var i = 0; i < liste.length; i++) if (liste[i].key === k) return liste[i]; return null; }

      /* KEIN eigener Escape-Zuhoerer. core hat einen seitenweiten: die Popover-Registry schliesst
         bei Escape ALLES (core.js, closeAll im keydown der Registry). Ich hatte hier erst zwei
         Stufen gebaut -- erst das Untermenue, dann das Panel -- und gemessen, dass das nicht
         geht: core ist zuerst angemeldet, laeuft also zuerst, und ein stopPropagation aus der
         Blasenphase erreicht ihn nicht mehr. Es waere auch die falsche Sache: Escape bedeutet in
         dieser App "das Dropdown zu", und diese Leiste waere der einzige Ort mit einer eigenen
         Bedeutung. Das Untermenue geht beim Schliessen des Panels ohnehin mit (onClose oben). */

      /* ---------------- Reset ---------------- */
      function alleLeeren() {
        /* Still: jeder Filter bekommt setSelected("") -- das raeumt die Auswahl auf und laesst die
           LISTE stehen (resetXFilter wuerde auch die Liste wegwerfen, das ist der Weg fuer einen
           Team- oder Projektwechsel und hier falsch). Und es schickt nichts: drei Filter-Ereignisse
           plus dieses eine wuerden dieselbe Abfrage viermal anstossen. */
        liste.forEach(function (f) {
          var w = eingezogen[f.key];
          var c = w && w[f.ctrl];
          if (c && typeof c.setSelected === "function") { try { c.setSelected(""); } catch (e) {} }
        });
        spiegelnAlle();
        render();
        fire("data-reset-fn", "ufbReset", { action: "clear_all" });
      }
      root.addEventListener("click", function (e) {
        if (!e.target.closest) return;
        if (e.target.closest("[data-ufb-reset]")) { e.stopPropagation(); alleLeeren(); pop.close(true); return; }
        if (e.target.closest("[data-ufb-clear]")) { alleLeeren(); return; }
      });

      /* ---------------- auf Aenderungen der Filter hoeren ----------------
         Ihre eigenen aufsteigenden Ereignisse. Am DOKUMENT und nicht an der Wurzel: die Wurzel
         wandert beim Einziehen, und ein Zuhoerer daran ginge beim naechsten Bubble-Rerender
         verloren. */
      FILTERS.forEach(function (f) {
        document.addEventListener(f.evt, function () { spiegeln(f); render(); }, false);
      });

      /* Die Filterelemente koennen SPAETER erscheinen -- Bubble baut sie unabhaengig von diesem
         Element. Ein kurzer Anlauf plus der Beobachter aus core holt sie nach. */
      [0, 150, 500, 1200, 2500].forEach(function (ms) { setTimeout(einziehen, ms); });
      if (window.MutationObserver) {
        var obs = new MutationObserver(function () {
          /* Nur wenn wirklich etwas fehlt -- sonst laeuft der Beobachter bei jeder Mutation der
             Seite durch drei querySelectorAll. */
          for (var i = 0; i < liste.length; i++) {
            var w = eingezogen[liste[i].key];
            if (!w || !document.contains(w)) { einziehen(); return; }
          }
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }
      if (UC.aufResize) UC.aufResize(render);

      var ctrl = {
        reset: function () { alleLeeren(); },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); },
        render: render
      };
      root.__ufbCtrl = ctrl;
      /* Ein ATTRIBUT und nicht nur die Eigenschaft: der Beobachter oben prueft mit einem
         Selektor, und das ist eine Abfrage statt einer Schleife ueber alle Wurzeln. */
      root.setAttribute("data-ufb-init", "1");
      CTRLS.push(ctrl);
      render();
      if (spaet) spaet.drain(instanceId, ctrl);
      return ctrl;
    }

    function initAll() {
      Array.prototype.forEach.call(document.querySelectorAll(".ufb-root, [data-ufb-root]"), initRoot);
    }
    function forEachInstance(id, fn) {
      initAll();
      var roots = Array.prototype.slice.call(document.querySelectorAll(".ufb-root"));
      var ziel = roots.filter(function (r) {
        var rid = String(r.getAttribute("data-instance") || "default");
        return !id || rid === id || rid.indexOf(String(id)) === 0;
      });
      if (!ziel.length) {
        if (spaet) spaet.park(id || "default", fn);
        return false;
      }
      ziel.forEach(function (r) { if (r.__ufbCtrl) fn(r.__ufbCtrl); });
      return true;
    }

    window.resetFilterBar = function (id) { return forEachInstance(id, function (c) { c.reset(); }); };
    window.setFilterBarTheme = function (id, t) { return forEachInstance(id, function (c) { c.setTheme(t); }); };

    initAll();
    if (UC.watchRoots) UC.watchRoots("ufb-root", initAll);
    [100, 300, 800, 1800].forEach(function (ms) { setTimeout(initAll, ms); });
    /* Eigenes Netz fuer eine Leiste, die SPAETER erscheint. UC.watchRoots ist dafuer gedacht, hat
       im Gegentest aber nicht angeschlagen (eine frisch eingehaengte Wurzel blieb 2,2s
       uneingerichtet, Zaehler 0). Die Zeitstaffel oben faengt den Normalfall -- Bubble baut das
       Element innerhalb der ersten zwei Sekunden --, dieser Beobachter den Rest: einen Rerender
       nach einem Ansichtswechsel, ein Drawer, der erst spaeter aufgeht.
       Gebuendelt auf einen Lauf je 200ms, und nur wenn wirklich eine Wurzel ohne Controller
       dasteht: sonst laeuft er bei jeder Mutation der Seite durch ein querySelectorAll. */
    if (window.MutationObserver){
      var uhr = null;
      new MutationObserver(function(){
        if (uhr) return;
        uhr = setTimeout(function(){
          uhr = null;
          var offen = document.querySelector(".ufb-root:not([data-ufb-init])");
          if (offen) initAll();
        }, 200);
      }).observe(document.body, { childList: true, subtree: true });
    }

    /* Die Warteschlange abarbeiten, in der Reihenfolge, in der Bubble gerufen hat. */
    var q = window.__ufbBootQueue;
    if (q && q.length) {
      q.splice(0, q.length).forEach(function (e) {
        try { window[e[0]].apply(null, e[1]); }
        catch (err) { if (window.console) console.error("[filter-bar] queued " + e[0] + " failed:", err); }
      });
    }
  }

  ufbBoot(50);
})();
